import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { hashToken } from '../utils/hashToken.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import {
  EMAIL_ALREADY_REGISTERED,
  INVALID_CREDENTIALS,
  LOGIN_FIELDS_REQUIRED,
  REFRESH_TOKEN_EXPIRED,
  REFRESH_TOKEN_INVALID,
  REFRESH_TOKEN_NOT_ACTIVE,
  REFRESH_TOKEN_REQUIRED,
  REFRESH_TOKEN_REVOKED,
  REGISTER_FIELDS_REQUIRED,
  REGISTER_VALIDATION_FAILED,
} from '../utils/errorCodes.js';

export const BCRYPT_ROUNDS = 10;

function trimOrEmpty(v) {
  if (v == null) return '';
  return String(v).trim();
}

export function userPublic(doc) {
  const role = doc.role ?? 'user';
  return {
    id: doc._id.toString(),
    email: doc.email,
    firstName: doc.firstName,
    lastName: doc.lastName,
    role,
    profilePic: doc.profilePic ?? null,
  };
}

export async function register(req, res) {
  const firstName = trimOrEmpty(req.body?.firstName);
  const lastName = trimOrEmpty(req.body?.lastName);
  const email = trimOrEmpty(req.body?.email);
  const password = trimOrEmpty(req.body?.password);

  if (!firstName || !lastName || !email || !password) {
    return sendError(
      res,
      400,
      'firstName, lastName, email, and password are required',
      REGISTER_FIELDS_REQUIRED,
    );
  }

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const emailKey = email.toLowerCase();
    const user = await User.create({
      firstName,
      lastName,
      email: emailKey,
      passwordHash,
    });
    return sendSuccess(res, { user: userPublic(user) }, 201);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return sendError(res, 400, err.message, REGISTER_VALIDATION_FAILED);
    }
    if (err.code === 11000) {
      return sendError(res, 409, 'Email already registered', EMAIL_ALREADY_REGISTERED);
    }
    throw err;
  }
}

export async function login(req, res) {
  const email = trimOrEmpty(req.body?.email);
  const password = trimOrEmpty(req.body?.password);

  if (!email || !password) {
    return sendError(res, 400, 'email and password are required', LOGIN_FIELDS_REQUIRED);
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user) {
    return sendError(res, 401, 'Invalid email or password', INVALID_CREDENTIALS);
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return sendError(res, 401, 'Invalid email or password', INVALID_CREDENTIALS);
  }

  const accessToken = signAccessToken(user._id.toString(), user.role ?? 'user');
  const refreshToken = signRefreshToken(user._id.toString());
  const decoded = jwt.decode(refreshToken);
  const expSec = decoded?.exp;
  const expiresAt = expSec ? new Date(expSec * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt,
  });

  return sendSuccess(res, {
    accessToken,
    refreshToken,
    user: userPublic(user),
  });
}

export async function refresh(req, res) {
  const refreshToken = req.body?.refreshToken;
  if (!refreshToken || typeof refreshToken !== 'string') {
    return sendError(
      res,
      400,
      'Request body must include a non-empty refreshToken string.',
      REFRESH_TOKEN_REQUIRED,
    );
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (err) {
    if (err?.name === 'TokenExpiredError') {
      return sendError(
        res,
        401,
        'Refresh token has expired. Sign in again to obtain a new one.',
        REFRESH_TOKEN_EXPIRED,
      );
    }
    if (err?.name === 'JsonWebTokenError') {
      return sendError(
        res,
        401,
        'Refresh token is invalid or malformed (wrong signature, wrong type, or corrupted).',
        REFRESH_TOKEN_INVALID,
      );
    }
    if (err?.name === 'NotBeforeError') {
      return sendError(
        res,
        401,
        'Refresh token is not valid yet (nbf claim). Try again later.',
        REFRESH_TOKEN_NOT_ACTIVE,
      );
    }
    throw err;
  }

  const userId = payload.sub;
  const stored = await RefreshToken.findOne({
    tokenHash: hashToken(refreshToken),
    user: userId,
  });

  if (!stored) {
    return sendError(
      res,
      401,
      'This refresh token is not recognized. It may have been revoked, replaced, or already used.',
      REFRESH_TOKEN_REVOKED,
    );
  }

  const user = await User.findById(userId).select('role');
  const role = user?.role ?? 'user';
  const accessToken = signAccessToken(userId, role);
  return sendSuccess(res, { accessToken });
}

export async function logout(req, res) {
  const refreshToken = req.body?.refreshToken;
  if (!refreshToken || typeof refreshToken !== 'string') {
    return sendError(
      res,
      400,
      'Request body must include a non-empty refreshToken string.',
      REFRESH_TOKEN_REQUIRED,
    );
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (err) {
    if (err?.name === 'TokenExpiredError') {
      return sendError(
        res,
        401,
        'Refresh token has expired. Sign in again to obtain a new one.',
        REFRESH_TOKEN_EXPIRED,
      );
    }
    if (err?.name === 'JsonWebTokenError') {
      return sendError(
        res,
        401,
        'Refresh token is invalid or malformed (wrong signature, wrong type, or corrupted).',
        REFRESH_TOKEN_INVALID,
      );
    }
    if (err?.name === 'NotBeforeError') {
      return sendError(
        res,
        401,
        'Refresh token is not valid yet (nbf claim). Try again later.',
        REFRESH_TOKEN_NOT_ACTIVE,
      );
    }
    throw err;
  }

  const userId = payload.sub;
  await RefreshToken.deleteOne({
    tokenHash: hashToken(refreshToken),
    user: userId,
  });

  return sendSuccess(res, { loggedOut: true });
}
