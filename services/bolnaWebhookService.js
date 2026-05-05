import mongoose from 'mongoose';
import { Appointment } from '../models/Appointment.js';
import { VoiceExecutionLog } from '../models/VoiceExecutionLog.js';
import { normalizeBolnaExecutionPayload } from './bolnaNormalize.js';
import * as appointmentService from './appointmentService.js';

const TERMINAL_LOG_STATUSES = new Set([
  'completed',
  'no-answer',
  'busy',
  'failed',
  'error',
  'canceled',
  'stopped',
  'balance-low',
  'call-disconnected',
]);

function isValidAppointmentId(s) {
  return s != null && mongoose.isValidObjectId(String(s));
}

function hasNonEmptyExtractedData(norm) {
  const ex = norm.extracted_data;
  return ex != null && typeof ex === 'object' && Object.keys(ex).length > 0;
}

/**
 * Process Bolna execution webhook body.
 * Appointment updates run only when the payload includes non-empty `extracted_data`.
 * @returns {Promise<{ ok: boolean, missing?: string, appointment?: import('mongoose').Document, progress?: boolean, executionLogDuplicate?: boolean, skippedNoExtraction?: boolean }>}
 */
export async function processBolnaWebhook(body) {
  const norm = normalizeBolnaExecutionPayload(body);

  if (!norm.executionId || String(norm.executionId).trim() === '') {
    return { ok: false, missing: 'executionId' };
  }
  if (!norm.status || String(norm.status).trim() === '') {
    return { ok: false, missing: 'status' };
  }

  if (!hasNonEmptyExtractedData(norm)) {
    return { ok: true, skippedNoExtraction: true };
  }

  if (!isValidAppointmentId(norm.appointmentId)) {
    return { ok: false, missing: 'appointmentId' };
  }

  const appt = await Appointment.findById(norm.appointmentId);
  if (!appt) {
    return { ok: false, missing: 'appointment' };
  }

  const isTerminal = TERMINAL_LOG_STATUSES.has(norm.status);

  if (!isTerminal) {
    const result = await appointmentService.syncBolnaProgressToAppointment(appt, norm);
    return { ok: true, appointment: result.appointment, progress: true };
  }

  let executionLogDuplicate = false;
  try {
    await VoiceExecutionLog.create({
      ownerId: appt.ownerId,
      executionId: String(norm.executionId),
      appointmentId: appt._id,
      payload: body,
    });
  } catch (err) {
    if (err?.code === 11000) {
      executionLogDuplicate = true;
    } else {
      throw err;
    }
  }

  const fresh = await Appointment.findById(norm.appointmentId);
  if (!fresh) {
    return { ok: false, missing: 'appointment' };
  }

  const result = await appointmentService.applyVoiceOutcomeToAppointment(fresh, norm);
  return {
    ok: true,
    appointment: result.appointment,
    executionLogDuplicate,
  };
}
