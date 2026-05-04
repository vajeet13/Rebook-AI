/**
 * Normalize Bolna webhook / execution payload (see AgentExecution in Bolna OpenAPI).
 * Webhooks may send the execution object directly or wrapped.
 */
export function unwrapBolnaBody(body) {
  if (body == null) return null;
  if (typeof body !== 'object') return null;
  if (body.execution && typeof body.execution === 'object') return body.execution;
  if (body.data && typeof body.data === 'object') return body.data;
  if (body.payload && typeof body.payload === 'object') return body.payload;
  return body;
}

export function normalizeBolnaExecutionPayload(body) {
  const raw = unwrapBolnaBody(body);
  if (!raw || typeof raw !== 'object') {
    return {
      executionId: null,
      status: null,
      extracted_data: {},
      context_details: {},
      transcript: '',
      summary: '',
      appointmentId: null,
    };
  }

  const extracted_data = raw.extracted_data ?? raw.extractedData ?? {};
  const context_details = raw.context_details ?? raw.contextDetails ?? {};
  const executionId = raw.id ?? raw.execution_id ?? null;
  const status = raw.status ?? raw.call_status ?? null;
  const transcript = typeof raw.transcript === 'string' ? raw.transcript : '';
  const summary =
    typeof raw.summary === 'string'
      ? raw.summary
      : typeof extracted_data.summary === 'string'
        ? extracted_data.summary
        : '';

  const recipient =
    context_details.recipient_data ??
    context_details.recipientData ??
    {};
  const appointmentId =
    recipient.appointmentId ??
    recipient.appointment_id ??
    context_details.appointmentId ??
    context_details.appointment_id ??
    extracted_data.appointment_id ??
    extracted_data.appointmentId ??
    null;

  return {
    executionId,
    status,
    extracted_data: extracted_data && typeof extracted_data === 'object' ? extracted_data : {},
    context_details: context_details && typeof context_details === 'object' ? context_details : {},
    transcript,
    summary,
    appointmentId: appointmentId != null ? String(appointmentId).trim() : null,
  };
}
