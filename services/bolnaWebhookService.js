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

/**
 * Process Bolna execution webhook body.
 * @returns {Promise<{ ok: boolean, duplicate?: boolean, missing?: string, appointment?: import('mongoose').Document }>}
 */
export async function processBolnaWebhook(body) {
  const norm = normalizeBolnaExecutionPayload(body);

  if (!norm.executionId || String(norm.executionId).trim() === '') {
    return { ok: false, missing: 'executionId' };
  }
  if (!norm.status || String(norm.status).trim() === '') {
    return { ok: false, missing: 'status' };
  }
  if (!TERMINAL_LOG_STATUSES.has(norm.status)) {
    return { ok: true, ignored: true };
  }

  if (!isValidAppointmentId(norm.appointmentId)) {
    return { ok: false, missing: 'appointmentId' };
  }

  const appt = await Appointment.findById(norm.appointmentId);
  if (!appt) {
    return { ok: false, missing: 'appointment' };
  }

  try {
    await VoiceExecutionLog.create({
      ownerId: appt.ownerId,
      executionId: String(norm.executionId),
      appointmentId: appt._id,
      payload: body,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return { ok: true, duplicate: true };
    }
    throw err;
  }

  const fresh = await Appointment.findById(norm.appointmentId);
  if (!fresh) {
    return { ok: false, missing: 'appointment' };
  }

  const result = await appointmentService.applyVoiceOutcomeToAppointment(fresh, norm);
  return { ok: true, appointment: result.appointment };
}
