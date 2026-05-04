/**
 * Standard JSON envelope for API responses.
 * Success: { success: true, data }
 * Error:   { success: false, error: { message, code? } }
 */

export function sendSuccess(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function sendError(res, status, message, code) {
  const error = { message };
  if (code != null && code !== '') {
    error.code = code;
  }
  return res.status(status).json({ success: false, error });
}
