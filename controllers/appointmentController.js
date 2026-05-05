import mongoose from 'mongoose';
import { Appointment } from '../models/Appointment.js';
import { Client } from '../models/Client.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import {
  APPOINTMENT_NOT_FOUND,
  APPOINTMENT_CANNOT_COMPLETE,
  APPOINTMENT_FIELDS_REQUIRED,
  CLIENT_NOT_FOUND,
} from '../utils/errorCodes.js';
import { toOwnerObjectId } from '../utils/ownerId.js';
import * as appointmentService from '../services/appointmentService.js';

function appointmentPublic(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: o._id.toString(),
    ownerId: o.ownerId?.toString?.() ?? String(o.ownerId),
    clientId: o.clientId?.toString?.() ?? String(o.clientId),
    contactPhone: o.contactPhone ?? null,
    startsAt: o.startsAt,
    endsAt: o.endsAt,
    serviceId: o.serviceId ?? null,
    resourceId: o.resourceId ?? null,
    status: o.status,
    previousStartsAt: o.previousStartsAt ?? null,
    previousEndsAt: o.previousEndsAt ?? null,
    rescheduledAt: o.rescheduledAt ?? null,
    lastBolnaExecutionId: o.lastBolnaExecutionId ?? null,
    recoveryCallScheduledFor: o.recoveryCallScheduledFor ?? null,
    voiceOutcome: o.voiceOutcome ?? {},
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

export async function createAppointment(req, res) {
  const ownerId = toOwnerObjectId(req.userId);
  if (!ownerId) {
    return sendError(res, 400, 'Invalid session', APPOINTMENT_FIELDS_REQUIRED);
  }

  const clientId = req.body?.clientId;
  if (!clientId || !mongoose.isValidObjectId(String(clientId))) {
    return sendError(res, 400, 'clientId is required', APPOINTMENT_FIELDS_REQUIRED);
  }

  const client = await Client.findOne({ _id: clientId, ownerId });
  if (!client) {
    return sendError(res, 404, 'Client not found', CLIENT_NOT_FOUND);
  }

  const startsAtRaw = req.body?.startsAt;
  const endsAtRaw = req.body?.endsAt;
  if (!startsAtRaw || !endsAtRaw) {
    return sendError(res, 400, 'startsAt and endsAt are required', APPOINTMENT_FIELDS_REQUIRED);
  }

  const startsAt = new Date(startsAtRaw);
  const endsAt = new Date(endsAtRaw);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return sendError(res, 400, 'startsAt and endsAt must be valid dates', APPOINTMENT_FIELDS_REQUIRED);
  }
  if (endsAt.getTime() <= startsAt.getTime()) {
    return sendError(res, 400, 'endsAt must be after startsAt', APPOINTMENT_FIELDS_REQUIRED);
  }

  const serviceId = req.body?.serviceId != null ? String(req.body.serviceId).trim() || null : null;
  const resourceId = req.body?.resourceId != null ? String(req.body.resourceId).trim() || null : null;

  const appt = await Appointment.create({
    ownerId,
    clientId: client._id,
    contactPhone: client.phone ?? null,
    startsAt,
    endsAt,
    serviceId,
    resourceId,
    status: 'scheduled',
  });

  return sendSuccess(res, { appointment: appointmentPublic(appt) }, 201);
}

export async function listAppointments(req, res) {
  const ownerId = toOwnerObjectId(req.userId);
  if (!ownerId) {
    return sendError(res, 400, 'Invalid session', APPOINTMENT_FIELDS_REQUIRED);
  }
  const status = req.query?.status ? String(req.query.status) : undefined;
  const limit = req.query?.limit ? Math.min(100, Number(req.query.limit) || 50) : 50;
  const rows = await appointmentService.listAppointmentsForTenant(ownerId, { status, limit });
  return sendSuccess(res, { appointments: rows.map((r) => appointmentPublic(r)) });
}

export async function getAppointmentById(req, res) {
  const ownerId = toOwnerObjectId(req.userId);
  if (!ownerId) {
    return sendError(res, 400, 'Invalid session', APPOINTMENT_FIELDS_REQUIRED);
  }
  const { appointmentId } = req.params;
  if (!mongoose.isValidObjectId(appointmentId)) {
    return sendError(res, 404, 'Appointment not found', APPOINTMENT_NOT_FOUND);
  }
  const row = await appointmentService.getAppointmentByIdForTenant(appointmentId, ownerId);
  if (!row) {
    return sendError(res, 404, 'Appointment not found', APPOINTMENT_NOT_FOUND);
  }
  return sendSuccess(res, { appointment: appointmentPublic(row) });
}

export async function completeAppointment(req, res) {
  const ownerId = toOwnerObjectId(req.userId);
  if (!ownerId) {
    return sendError(res, 400, 'Invalid session', APPOINTMENT_FIELDS_REQUIRED);
  }
  const { appointmentId } = req.params;
  if (!mongoose.isValidObjectId(appointmentId)) {
    return sendError(res, 404, 'Appointment not found', APPOINTMENT_NOT_FOUND);
  }
  const result = await appointmentService.markAppointmentCompletedForTenant(appointmentId, ownerId);
  if (result.error === 'not_found') {
    return sendError(res, 404, 'Appointment not found', APPOINTMENT_NOT_FOUND);
  }
  if (result.error === 'cancelled') {
    return sendError(res, 409, 'Cancelled appointments cannot be marked completed', APPOINTMENT_CANNOT_COMPLETE);
  }
  return sendSuccess(res, { appointment: appointmentPublic(result.appointment) });
}

export async function updateAppointmentSchedule(req, res) {
  const ownerId = toOwnerObjectId(req.userId);
  if (!ownerId) {
    return sendError(res, 400, 'Invalid session', APPOINTMENT_FIELDS_REQUIRED);
  }
  const { appointmentId } = req.params;
  if (!mongoose.isValidObjectId(appointmentId)) {
    return sendError(res, 404, 'Appointment not found', APPOINTMENT_NOT_FOUND);
  }

  const startsAtRaw = req.body?.startsAt;
  const endsAtRaw = req.body?.endsAt;
  if (!startsAtRaw || !endsAtRaw) {
    return sendError(res, 400, 'startsAt and endsAt are required', APPOINTMENT_FIELDS_REQUIRED);
  }

  const startsAt = new Date(startsAtRaw);
  const endsAt = new Date(endsAtRaw);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return sendError(res, 400, 'startsAt and endsAt must be valid dates', APPOINTMENT_FIELDS_REQUIRED);
  }
  if (endsAt.getTime() <= startsAt.getTime()) {
    return sendError(res, 400, 'endsAt must be after startsAt', APPOINTMENT_FIELDS_REQUIRED);
  }

  const result = await appointmentService.updateAppointmentScheduleForTenant(appointmentId, ownerId, {
    startsAt,
    endsAt,
  });
  if (result.error === 'not_found') {
    return sendError(res, 404, 'Appointment not found', APPOINTMENT_NOT_FOUND);
  }
  return sendSuccess(res, { appointment: appointmentPublic(result.appointment) });
}
