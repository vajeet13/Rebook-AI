import jwt from 'jsonwebtoken';

function getAccessSecret() {
  const s = process.env.JWT_ACCESS_SECRET;
  if (!s) throw new Error('JWT_ACCESS_SECRET is not set');
  return s;
}

function getRefreshSecret() {
  const s = process.env.JWT_REFRESH_SECRET;
  if (!s) throw new Error('JWT_REFRESH_SECRET is not set');
  return s;
}

export function signAccessToken(userId, role = 'user') {
  const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
  return jwt.sign({ sub: userId, role }, getAccessSecret(), { expiresIn });
}

export function signRefreshToken(userId) {
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  return jwt.sign({ sub: userId }, getRefreshSecret(), { expiresIn });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, getRefreshSecret());
}
