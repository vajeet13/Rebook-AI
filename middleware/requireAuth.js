import jwt from 'jsonwebtoken';
import { sendError } from '../utils/apiResponse.js';
import {
  AUTH_BEARER_REQUIRED,
  JWT_ACCESS_SECRET_MISSING,
  TOKEN_EXPIRED,
  TOKEN_INVALID,
} from '../utils/errorCodes.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return sendError(res, 401, 'Unauthorized', AUTH_BEARER_REQUIRED);
  }
  const token = header.slice(7);
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    return sendError(res, 500, 'Server configuration error', JWT_ACCESS_SECRET_MISSING);
  }
  try {
    const payload = jwt.verify(token, secret);
    req.userId = payload.sub;
    req.userRole = payload.role ?? 'user';
    next();
  } catch (err) {
    if (err?.name === 'TokenExpiredError') {
      return sendError(res, 401, 'Access token expired', TOKEN_EXPIRED);
    }
    return sendError(res, 401, 'Invalid or unauthorized token', TOKEN_INVALID);
  }
}
