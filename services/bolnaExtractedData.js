/**
 * Parse Bolna `extracted_data` when extractions live under `call-detail`
 * (e.g. call_summary, reschedule_time, appointment_status, cancellation_reason),
 * each often shaped as `{ subjective, confidence, ... }`.
 * @param {Record<string, unknown>|null|undefined} extracted_data
 * @returns {{ callSummary: string|null, rescheduleTimeIso: string|null, appointmentStatus: string|null, cancellationReason: string|null }|null}
 */
export function parseCallDetailFromExtractedData(extracted_data) {
  if (!extracted_data || typeof extracted_data !== 'object') {
    return null;
  }
  const detail =
    extracted_data['call-detail'] ??
    extracted_data.call_detail ??
    extracted_data.callDetail ??
    null;
  if (!detail || typeof detail !== 'object') {
    return null;
  }

  function pickSubjective(field) {
    if (field == null) return null;
    if (typeof field === 'object' && field !== null && 'subjective' in field) {
      const v = /** @type {{ subjective?: unknown }} */ (field).subjective;
      if (v == null || v === '') return null;
      const s = String(v).trim();
      return s.length ? s : null;
    }
    if (typeof field === 'string') {
      const s = field.trim();
      return s.length ? s : null;
    }
    return null;
  }

  const callSummary = pickSubjective(detail.call_summary);
  const rescheduleTimeIso = pickSubjective(detail.reschedule_time);
  const appointmentStatus = pickSubjective(detail.appointment_status);
  const cancellationReason = pickSubjective(detail.cancellation_reason);

  if (!callSummary && !rescheduleTimeIso && !appointmentStatus && !cancellationReason) {
    return null;
  }

  return {
    callSummary,
    rescheduleTimeIso,
    appointmentStatus,
    cancellationReason,
  };
}
