import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { BOLNA_WEBHOOK_BAD_REQUEST } from '../utils/errorCodes.js';
import * as bolnaWebhookService from '../services/bolnaWebhookService.js';

export async function handleBolnaWebhook(req, res) {
  const result = await bolnaWebhookService.processBolnaWebhook(req.body);
  if (result.duplicate) {
    return sendSuccess(res, { processed: false, duplicate: true });
  }
  if (result.ignored) {
    return sendSuccess(res, { processed: false, ignored: true });
  }
  if (!result.ok) {
    const msg =
      result.missing === 'executionId'
        ? 'execution id missing'
        : result.missing === 'status'
          ? 'status missing'
          : result.missing === 'appointmentId'
            ? 'appointmentId missing (set context / extraction)'
            : result.missing === 'appointment'
              ? 'appointment not found'
              : 'invalid payload';
    const status = result.missing === 'appointment' ? 404 : 400;
    return sendError(res, status, msg, BOLNA_WEBHOOK_BAD_REQUEST);
  }
  return sendSuccess(res, { processed: true });
}
