import mongoose from 'mongoose';
import { Appointment } from '../models/Appointment.js';
import { Client } from '../models/Client.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import {
  APPOINTMENT_BOLNA_EXECUTION_MISSING,
  APPOINTMENT_FIELDS_REQUIRED,
  APPOINTMENT_NOT_FOUND,
  BOLNA_DIRECT_APPOINTMENT_CLIENT_PHONE_MISSING,
  INTERNAL_SERVER_ERROR,
} from '../utils/errorCodes.js';
import { toOwnerObjectId } from '../utils/ownerId.js';
import {
  getBolnaExecution,
  initiateBolnaOutboundCall,
  pickBolnaExecutionId,
} from '../services/bolnaClient.js';

/**
 * Finds appointments starting in ~CONFIRMATION_LEAD_MINUTES (default 120) ± window, and initiates Bolna calls when API key is set.
 * Requires JWT (`requireAuth`).
 */
export async function triggerConfirmationCalls(req, res) {
  const leadMin = Number(process.env.CONFIRMATION_LEAD_MINUTES || 120);
  const windowMin = Number(process.env.CONFIRMATION_LEAD_WINDOW_MINUTES || 15);
  const leadMs = leadMin * 60 * 1000;
  const winMs = windowMin * 60 * 1000;
  const now = Date.now();
  const target = now + leadMs;
  const minStart = new Date(target - winMs);
  const maxStart = new Date(target + winMs);

  const agentId = process.env.BOLNA_AGENT_ID || '';

  const candidates = await Appointment.find({
    startsAt: { $gte: minStart, $lte: maxStart },
    status: { $in: ['scheduled', 'confirmed'] },
    $or: [{ lastBolnaExecutionId: null }, { lastBolnaExecutionId: '' }],
  })
    .limit(50)
    .lean();

  const results = [];

  for (const appt of candidates) {
    const client = await Client.findById(appt.clientId).lean();
    if (!client?.phone) {
      results.push({ appointmentId: appt._id.toString(), skipped: true, reason: 'no_phone' });
      continue;
    }

    try {
      const call = await initiateBolnaOutboundCall({
        agentId,
        recipientPhoneNumber: client.phone,
        userData: {
          appointmentId: appt._id.toString(),
          clientFirstName: client.firstName,
          clientLastName: client.lastName,
        },
      });

      if (call.skipped) {
        results.push({
          appointmentId: appt._id.toString(),
          skipped: true,
          reason: call.reason || 'bolna_not_configured',
        });
        continue;
      }

      const exId = pickBolnaExecutionId(call.body);

      await Appointment.findByIdAndUpdate(appt._id, {
        $set: {
          lastBolnaExecutionId: exId ? String(exId) : appt.lastBolnaExecutionId,
          recoveryCallScheduledFor: new Date(),
          status: appt.status === 'scheduled' ? 'pending_confirmation' : appt.status,
        },
      });

      results.push({
        appointmentId: appt._id.toString(),
        called: true,
        lastBolnaExecutionId: exId || null,
      });
    } catch (err) {
      results.push({
        appointmentId: appt._id.toString(),
        error: err?.message || 'call_failed',
      });
    }
  }

  return sendSuccess(res, {
    window: { minStart, maxStart },
    count: candidates.length,
    results,
  });
}

/**
 * POST `/:appointmentId` — dials the client on file for that appointment (tenant-scoped).
 * Body: optional `agentId`, optional `userData` object (merged with appointment context).
 * Requires JWT (`requireAuth`).
 */
export async function triggerBolnaCallDirect(req, res) {
  const ownerId = toOwnerObjectId(req.userId);
  if (!ownerId) {
    return sendError(res, 400, 'Invalid session', APPOINTMENT_FIELDS_REQUIRED);
  }

  const appointmentIdRaw =
    typeof req.params?.appointmentId === 'string' ? req.params.appointmentId.trim() : '';
  if (!appointmentIdRaw || !mongoose.isValidObjectId(appointmentIdRaw)) {
    return sendError(res, 404, 'Appointment not found', APPOINTMENT_NOT_FOUND);
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const nestedUserData =
    body.userData && typeof body.userData === 'object' && !Array.isArray(body.userData)
      ? body.userData
      : {};

  const appt = await Appointment.findOne({
    _id: appointmentIdRaw,
    ownerId,
  }).lean();
  if (!appt) {
    return sendError(res, 404, 'Appointment not found', APPOINTMENT_NOT_FOUND);
  }

  const client = await Client.findOne({ _id: appt.clientId, ownerId }).lean();
  const recipientPhone = (
    (client?.phone && String(client.phone).trim()) ||
    (appt.contactPhone && String(appt.contactPhone).trim()) ||
    ''
  );
  if (!recipientPhone) {
    return sendError(
      res,
      400,
      'Client for this appointment has no phone number',
      BOLNA_DIRECT_APPOINTMENT_CLIENT_PHONE_MISSING
    );
  }

  const agentId =
    (typeof body.agentId === 'string' && body.agentId.trim()) ||
    process.env.BOLNA_AGENT_ID ||
    '';

  const userData = {
    ...nestedUserData,
    appointmentId: appt._id.toString(),
    clientFirstName: client?.firstName,
    clientLastName: client?.lastName,
  };

  try {
    const call = await initiateBolnaOutboundCall({
      agentId,
      recipientPhoneNumber: recipientPhone,
      userData,
    });

    if (call.skipped) {
      return sendSuccess(res, {
        called: false,
        reason: call.reason || 'bolna_not_configured',
        appointmentId: appt._id.toString(),
      });
    }

    const exId = pickBolnaExecutionId(call.body);

    await Appointment.findByIdAndUpdate(appt._id, {
      $set: {
        lastBolnaExecutionId: exId ? String(exId) : appt.lastBolnaExecutionId,
        recoveryCallScheduledFor: new Date(),
        status: appt.status === 'scheduled' ? 'pending_confirmation' : appt.status,
      },
    });

    return sendSuccess(res, {
      called: true,
      lastBolnaExecutionId: exId || null,
      appointmentId: appt._id.toString(),
    });
  } catch (err) {
    return sendError(
      res,
      Number(err?.status) >= 400 && Number(err?.status) < 600 ? Number(err.status) : 502,
      err?.message || 'Bolna call failed',
      INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * GET `/:appointmentId` — loads `lastBolnaExecutionId` for the appointment (tenant-scoped)
 * and proxies Bolna GET /executions/{execution_id}. Requires JWT (`requireAuth`).
 */
export async function getBolnaExecutionInternal(req, res) {
  const ownerId = toOwnerObjectId(req.userId);
  if (!ownerId) {
    return sendError(res, 400, 'Invalid session', APPOINTMENT_FIELDS_REQUIRED);
  }

  const appointmentIdRaw =
    typeof req.params?.appointmentId === 'string' ? req.params.appointmentId.trim() : '';
  if (!appointmentIdRaw || !mongoose.isValidObjectId(appointmentIdRaw)) {
    return sendError(res, 404, 'Appointment not found', APPOINTMENT_NOT_FOUND);
  }

  const appt = await Appointment.findOne({
    _id: appointmentIdRaw,
    ownerId,
  })
    .select('lastBolnaExecutionId')
    .lean();
  if (!appt) {
    return sendError(res, 404, 'Appointment not found', APPOINTMENT_NOT_FOUND);
  }

  const executionId =
    typeof appt.lastBolnaExecutionId === 'string' ? appt.lastBolnaExecutionId.trim() : '';
  if (!executionId) {
    return sendError(
      res,
      404,
      'No Bolna execution is stored for this appointment yet',
      APPOINTMENT_BOLNA_EXECUTION_MISSING
    );
  }

  try {
    const result = await getBolnaExecution(executionId);

    if (result.skipped) {
      return sendSuccess(res, {
        fetched: false,
        reason: result.reason || 'bolna_not_configured',
      });
    }

    return sendSuccess(res, {
      fetched: true,
      appointmentId: appointmentIdRaw,
      executionId,
      execution: result.body,
    });
  } catch (err) {
    return sendError(
      res,
      Number(err?.status) >= 400 && Number(err?.status) < 600 ? Number(err.status) : 502,
      err?.message || 'Bolna execution fetch failed',
      INTERNAL_SERVER_ERROR
    );
  }
}
