import { sendError } from '../utils/apiResponse.js';
import { WEBHOOK_FORBIDDEN } from '../utils/errorCodes.js';

const BOLNA_WEBHOOK_IPS = new Set(
  (process.env.BOLNA_WEBHOOK_IPS || '13.203.39.153')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
);

function clientIp(req) {
  const x = req.headers['x-forwarded-for'];
  if (typeof x === 'string' && x.length) {
    return x.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '';
}

/**
 * Optional hardening: set BOLNA_WEBHOOK_VERIFY_IP=true and/or BOLNA_WEBHOOK_SECRET with ?token= on URL.
 */
export function verifyBolnaWebhook(req, res, next) {
  const secret = process.env.BOLNA_WEBHOOK_SECRET;
  if (secret) {
    const q = req.query?.token;
    const token = typeof q === 'string' ? q : Array.isArray(q) ? q[0] : '';
    if (token !== secret) {
      return sendError(res, 403, 'Webhook verification failed', WEBHOOK_FORBIDDEN);
    }
  }

  if (process.env.BOLNA_WEBHOOK_VERIFY_IP === 'true') {
    const ip = clientIp(req);
    const ok = BOLNA_WEBHOOK_IPS.has(ip);
    if (!ok) {
      return sendError(res, 403, 'Webhook verification failed', WEBHOOK_FORBIDDEN);
    }
  }

  next();
}
