import { Appointment } from '../models/Appointment.js';
import { parseCallDetailFromExtractedData } from './bolnaExtractedData.js';
import * as recoveryOrchestrator from './recoveryOrchestrator.js';

const TERMINAL_NO_CONVERSATION = new Set([
  'no-answer',
  'busy',
  'failed',
  'error',
  'canceled',
  'stopped',
  'balance-low',
]);

function mapExtractionToResolved(extracted, callDetail) {
  if (callDetail?.appointmentStatus) {
    const s = String(callDetail.appointmentStatus).trim().toLowerCase();
    if (['confirmed', 'confirm'].includes(s)) return 'confirmed';
    if (['cancelled', 'canceled', 'cancel'].includes(s)) return 'cancelled';
    if (['reschedule', 'rescheduled'].includes(s)) return 'reschedule_requested';
  }
  const raw =
    extracted?.appointment_outcome ??
    extracted?.appointmentOutcome ??
    extracted?.outcome ??
    '';
  const s = String(raw).trim().toLowerCase();
  if (['confirmed', 'confirm', 'yes', 'attending'].includes(s)) return 'confirmed';
  if (['cancelled', 'canceled', 'cancel', 'no'].includes(s)) return 'cancelled';
  if (['reschedule', 'rescheduled'].includes(s)) return 'reschedule_requested';
  return 'unknown';
}

function pickCancellationReason(extracted, callDetail) {
  if (callDetail?.cancellationReason) {
    const t = String(callDetail.cancellationReason).trim();
    if (t.length) return t;
  }
  const r =
    extracted?.cancellation_reason ??
    extracted?.cancellationReason ??
    extracted?.reason ??
    null;
  if (r == null) return null;
  const t = String(r).trim();
  return t.length ? t : null;
}

function parseNewSlotIso(extracted, callDetail) {
  if (callDetail?.rescheduleTimeIso) {
    const d = new Date(String(callDetail.rescheduleTimeIso));
    if (!Number.isNaN(d.getTime())) return d;
  }
  const raw =
    extracted?.new_slot_iso ??
    extracted?.newSlotIso ??
    extracted?.new_starts_at ??
    extracted?.newStartsAt ??
    null;
  if (raw == null || raw === '') return null;
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function assignVoiceOutcome(appt, voPatch) {
  const cur = appt.get('voiceOutcome')?.toObject?.() ?? appt.voiceOutcome ?? {};
  appt.set('voiceOutcome', { ...cur, ...voPatch });
}

/**
 * Apply webhook outcome when Bolna sends a terminal execution status.
 * @param {import('mongoose').Document} appt
 * @param {ReturnType<import('./bolnaNormalize.js').normalizeBolnaExecutionPayload>} norm
 */
export async function applyVoiceOutcomeToAppointment(appt, norm) {
  const hasExtracted =
    norm.extracted_data && typeof norm.extracted_data === 'object' && Object.keys(norm.extracted_data).length > 0;
  const callDetail = hasExtracted ? parseCallDetailFromExtractedData(norm.extracted_data) : null;
  const hasContext =
    norm.context_details &&
    typeof norm.context_details === 'object' &&
    Object.keys(norm.context_details).length > 0;

  const voPatch = {
    lastExecutionId: norm.executionId,
    rawStatus: norm.status,
    summary: norm.summary || callDetail?.callSummary || null,
    transcript: norm.transcript || null,
    extractedData: hasExtracted ? norm.extracted_data : null,
    contextDetails: hasContext ? norm.context_details : null,
    callSummary: callDetail?.callSummary ?? null,
    cancellationReason: pickCancellationReason(norm.extracted_data, callDetail),
    updatedAt: new Date(),
  };

  if (norm.status === 'completed') {
    const resolved = mapExtractionToResolved(norm.extracted_data, callDetail);
    voPatch.resolvedOutcome = resolved === 'unknown' ? 'unknown' : resolved;

    if (resolved === 'confirmed') {
      if (['scheduled', 'pending_confirmation', 'confirmed'].includes(appt.status)) {
        appt.status = 'confirmed';
      }
    } else if (resolved === 'cancelled') {
      if (['scheduled', 'pending_confirmation', 'confirmed'].includes(appt.status)) {
        appt.status = 'cancelled';
      }
    } else if (resolved === 'reschedule_requested') {
      const newStart = parseNewSlotIso(norm.extracted_data, callDetail);
      if (newStart) {
        const oldStart = appt.startsAt;
        const oldEnd = appt.endsAt;
        const durationMs = Math.max(0, oldEnd.getTime() - oldStart.getTime());
        appt.previousStartsAt = oldStart;
        appt.previousEndsAt = oldEnd;
        appt.rescheduledAt = new Date();
        appt.startsAt = newStart;
        appt.endsAt = new Date(newStart.getTime() + durationMs);
        appt.status = 'rescheduled';
        assignVoiceOutcome(appt, voPatch);
        if (norm.executionId) {
          appt.lastBolnaExecutionId = norm.executionId;
        }
        await appt.save();
        await recoveryOrchestrator.onRescheduleReleasedSlot(appt, oldStart, oldEnd);
        return { appointment: appt };
      }
      if (['scheduled', 'pending_confirmation', 'confirmed'].includes(appt.status)) {
        appt.status = 'pending_confirmation';
      }
    }
  } else if (TERMINAL_NO_CONVERSATION.has(norm.status)) {
    voPatch.resolvedOutcome = 'no_answer';
  } else {
    assignVoiceOutcome(appt, voPatch);
    if (norm.executionId) {
      appt.lastBolnaExecutionId = norm.executionId;
    }
    await appt.save();
    return { appointment: appt, noStateChange: true };
  }

  assignVoiceOutcome(appt, voPatch);
  if (norm.executionId) {
    appt.lastBolnaExecutionId = norm.executionId;
  }
  await appt.save();

  if (appt.status === 'cancelled') {
    await recoveryOrchestrator.onCancellation(appt);
  }

  return { appointment: appt };
}

/**
 * @param {string} appointmentId
 */
export async function loadAppointmentForTenant(appointmentId, ownerId) {
  return Appointment.findOne({ _id: appointmentId, ownerId }).exec();
}

/**
 * @param {import('mongoose').Types.ObjectId|string} ownerId
 */
export async function listAppointmentsForTenant(ownerId, { status, limit = 50 } = {}) {
  const q = { ownerId };
  if (status) q.status = status;
  return Appointment.find(q).sort({ startsAt: -1 }).limit(limit).lean();
}

/**
 * @param {import('mongoose').Types.ObjectId|string} ownerId
 */
export async function getAppointmentByIdForTenant(appointmentId, ownerId) {
  return Appointment.findOne({ _id: appointmentId, ownerId }).lean();
}

/**
 * @param {string} appointmentId
 * @param {import('mongoose').Types.ObjectId|string} ownerId
 * @returns {Promise<{ appointment: import('mongoose').Document } | { error: 'not_found' | 'cancelled' }>}
 */
export async function markAppointmentCompletedForTenant(appointmentId, ownerId) {
  const appt = await loadAppointmentForTenant(appointmentId, ownerId);
  if (!appt) return { error: 'not_found' };
  if (appt.status === 'cancelled') return { error: 'cancelled' };
  if (appt.status === 'completed') return { appointment: appt };
  appt.status = 'completed';
  await appt.save();
  return { appointment: appt };
}

/**
 * @param {string} appointmentId
 * @param {import('mongoose').Types.ObjectId|string} ownerId
 * @param {{ startsAt: Date; endsAt: Date }} times
 * @returns {Promise<{ appointment: import('mongoose').Document } | { error: 'not_found' }>}
 */
export async function updateAppointmentScheduleForTenant(appointmentId, ownerId, { startsAt, endsAt }) {
  const appt = await loadAppointmentForTenant(appointmentId, ownerId);
  if (!appt) return { error: 'not_found' };
  appt.startsAt = startsAt;
  appt.endsAt = endsAt;
  await appt.save();
  return { appointment: appt };
}
