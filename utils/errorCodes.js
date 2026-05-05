/**
 * `error.code` values for JSON errors (see utils/apiResponse.js). Append a row to `RAW`,
 * then add its code key to the `export const { … } = codes` list below.
 */

const RAW = [
  ['TOKEN_EXPIRED', 401, 'Access token expired', 'middleware/requireAuth.js'],
  ['TOKEN_INVALID', 401, 'Invalid or unauthorized token', 'middleware/requireAuth.js'],
  ['AUTH_BEARER_REQUIRED', 401, 'Unauthorized', 'middleware/requireAuth.js'],
  ['JWT_ACCESS_SECRET_MISSING', 500, 'Server configuration error', 'middleware/requireAuth.js'],
  [
    'REFRESH_TOKEN_REQUIRED',
    400,
    'Request body must include a non-empty refreshToken string.',
    'controllers/authController.js — refresh, logout',
  ],
  [
    'REFRESH_TOKEN_EXPIRED',
    401,
    'Refresh token has expired. Sign in again to obtain a new one.',
    'controllers/authController.js — refresh, logout',
  ],
  [
    'REFRESH_TOKEN_INVALID',
    401,
    'Refresh token is invalid or malformed (wrong signature, wrong type, or corrupted).',
    'controllers/authController.js — refresh, logout',
  ],
  [
    'REFRESH_TOKEN_NOT_ACTIVE',
    401,
    'Refresh token is not valid yet (nbf claim). Try again later.',
    'controllers/authController.js — refresh, logout',
  ],
  [
    'REFRESH_TOKEN_REVOKED',
    401,
    'This refresh token is not recognized. It may have been revoked, replaced, or already used.',
    'controllers/authController.js — refresh',
  ],
  [
    'REGISTER_FIELDS_REQUIRED',
    400,
    'firstName, lastName, email, and password are required',
    'controllers/authController.js — register',
  ],
  ['REGISTER_VALIDATION_FAILED', 400, '(Mongoose validation message)', 'controllers/authController.js — register'],
  ['EMAIL_ALREADY_REGISTERED', 409, 'Email already registered', 'controllers/authController.js — register'],
  ['LOGIN_FIELDS_REQUIRED', 400, 'email and password are required', 'controllers/authController.js — login'],
  ['INVALID_CREDENTIALS', 401, 'Invalid email or password', 'controllers/authController.js — login'],
  ['USER_ID_INVALID', 400, 'Invalid user id', 'controllers/userController.js — getUserById'],
  ['USER_NOT_FOUND', 404, 'User not found', 'controllers/userController.js'],
  [
    'PROFILE_UPDATE_NO_FIELDS',
    400,
    'Provide at least one of firstName or lastName',
    'controllers/userController.js — updateMyProfile',
  ],
  [
    'PROFILE_NAME_FIELDS_EMPTY',
    400,
    'firstName and lastName cannot be empty',
    'controllers/userController.js — updateMyProfile',
  ],
  [
    'PASSWORD_UPDATE_FIELDS_REQUIRED',
    400,
    'currentPassword and newPassword are required',
    'controllers/userController.js — updatePassword',
  ],
  ['CURRENT_PASSWORD_INCORRECT', 401, 'Current password is incorrect', 'controllers/userController.js — updatePassword'],
  [
    'NEW_PASSWORD_SAME_AS_CURRENT',
    400,
    'New password must be different from the current password',
    'controllers/userController.js — updatePassword',
  ],
  ['FORBIDDEN_INSUFFICIENT_ROLE', 403, 'Forbidden', 'middleware/requireRole.js'],
  ['CLIENT_NOT_FOUND', 404, 'Client not found', 'controllers/clientController.js'],
  ['CLIENT_FIELDS_REQUIRED', 400, 'Required client fields missing', 'controllers/clientController.js'],
  ['CLIENT_DUPLICATE_PHONE', 409, 'A client with this phone already exists', 'controllers/clientController.js'],
  ['APPOINTMENT_NOT_FOUND', 404, 'Appointment not found', 'controllers/appointmentController.js'],
  [
    'APPOINTMENT_CANNOT_COMPLETE',
    409,
    'Cancelled appointments cannot be marked completed',
    'controllers/appointmentController.js — completeAppointment',
  ],
  ['APPOINTMENT_FIELDS_REQUIRED', 400, 'Required appointment fields missing', 'controllers/appointmentController.js'],
  ['RATE_LIMIT_EXCEEDED', 429, 'Too many requests', 'middleware/rateLimiter.js'],
  ['WEBHOOK_FORBIDDEN', 403, 'Webhook verification failed', 'middleware/verifyBolnaWebhook.js'],
  ['BOLNA_WEBHOOK_BAD_REQUEST', 400, 'Invalid Bolna webhook payload', 'controllers/bolnaWebhookController.js'],
  [
    'APPOINTMENT_BOLNA_EXECUTION_MISSING',
    404,
    'No Bolna execution is stored for this appointment yet',
    'controllers/internalController.js',
  ],
  [
    'BOLNA_DIRECT_APPOINTMENT_CLIENT_PHONE_MISSING',
    400,
    'Client for this appointment has no phone number',
    'controllers/internalController.js',
  ],
  ['INTERNAL_SERVER_ERROR', 500, 'Internal Server Error', 'middleware/error.js'],
];

/** @type {ReadonlyArray<{ code: string; httpStatus: number; typicalMessage: string; where: string }>} */
export const ERROR_CODE_REFERENCE = Object.freeze(
  RAW.map(([code, httpStatus, typicalMessage, where]) => ({ code, httpStatus, typicalMessage, where }))
);

const codes = Object.fromEntries(RAW.map(([c]) => [c, c]));

export const {
  TOKEN_EXPIRED,
  TOKEN_INVALID,
  AUTH_BEARER_REQUIRED,
  JWT_ACCESS_SECRET_MISSING,
  REFRESH_TOKEN_REQUIRED,
  REFRESH_TOKEN_EXPIRED,
  REFRESH_TOKEN_INVALID,
  REFRESH_TOKEN_NOT_ACTIVE,
  REFRESH_TOKEN_REVOKED,
  REGISTER_FIELDS_REQUIRED,
  REGISTER_VALIDATION_FAILED,
  EMAIL_ALREADY_REGISTERED,
  LOGIN_FIELDS_REQUIRED,
  INVALID_CREDENTIALS,
  USER_ID_INVALID,
  USER_NOT_FOUND,
  PROFILE_UPDATE_NO_FIELDS,
  PROFILE_NAME_FIELDS_EMPTY,
  PASSWORD_UPDATE_FIELDS_REQUIRED,
  CURRENT_PASSWORD_INCORRECT,
  NEW_PASSWORD_SAME_AS_CURRENT,
  FORBIDDEN_INSUFFICIENT_ROLE,
  CLIENT_NOT_FOUND,
  CLIENT_FIELDS_REQUIRED,
  CLIENT_DUPLICATE_PHONE,
  APPOINTMENT_NOT_FOUND,
  APPOINTMENT_CANNOT_COMPLETE,
  APPOINTMENT_FIELDS_REQUIRED,
  WEBHOOK_FORBIDDEN,
  BOLNA_WEBHOOK_BAD_REQUEST,
  APPOINTMENT_BOLNA_EXECUTION_MISSING,
  INTERNAL_SERVER_ERROR,
  BOLNA_DIRECT_APPOINTMENT_CLIENT_PHONE_MISSING,
} = codes;
