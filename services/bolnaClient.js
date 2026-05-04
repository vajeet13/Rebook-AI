/**
 * Best-effort parse of Bolna `/call` success JSON for an execution/run id.
 * @param {Record<string, unknown>|null} body Parsed JSON response body
 * @returns {string|null}
 */
export function pickBolnaExecutionId(body) {
  if (!body || typeof body !== 'object') return null;
  const direct =
    body.id ??
    body.execution_id ??
    body.executionId ??
    body.last_bolna_execution_id ??
    null;
  if (direct != null && String(direct).trim() !== '') return String(direct).trim();
  const inner = body.data;
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    const nested =
      inner.id ??
      inner.execution_id ??
      inner.executionId ??
      null;
    if (nested != null && String(nested).trim() !== '') return String(nested).trim();
  }
  return null;
}

/**
 * Initiate outbound call via Bolna (POST https://api.bolna.ai/call).
 * @param {object} params
 * @param {string} params.agentId
 * @param {string} params.recipientPhoneNumber E.164
 * @param {Record<string, unknown>} [params.userData] context / dynamic variables (e.g. appointmentId)
 */
export async function initiateBolnaOutboundCall({
  agentId,
  recipientPhoneNumber,
  userData = {},
}) {
  const apiKey = process.env.BOLNA_API_KEY;
  if (!apiKey || !agentId || !recipientPhoneNumber) {
    return { skipped: true, reason: 'missing_env_or_params' };
  }

  const base = (process.env.BOLNA_API_BASE || 'https://api.bolna.ai').replace(/\/$/, '');
  const res = await fetch(`${base}/call`, {
    method: 'POST',
    headers: {
      Authorization: apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agent_id: agentId,
      recipient_phone_number: recipientPhoneNumber,
      user_data: userData,
    }),
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(json?.message || `Bolna call failed: ${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }

  return { ok: true, body: json };
}

/**
 * Fetch execution details from Bolna (GET https://api.bolna.ai/executions/{execution_id}).
 * @see https://www.bolna.ai/docs/api-reference/executions/get_execution
 * @param {string} executionId UUID of the execution
 */
export async function getBolnaExecution(executionId) {
  const apiKey = process.env.BOLNA_API_KEY;
  const id = typeof executionId === 'string' ? executionId.trim() : '';
  if (!apiKey || !id) {
    return { skipped: true, reason: 'missing_env_or_params' };
  }

  const base = (process.env.BOLNA_API_BASE || 'https://api.bolna.ai').replace(/\/$/, '');
  const res = await fetch(`${base}/executions/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: {
      Authorization: apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`,
    },
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(json?.message || `Bolna execution fetch failed: ${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }

  return { ok: true, body: json };
}
