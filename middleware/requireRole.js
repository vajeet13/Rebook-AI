import { sendError } from '../utils/apiResponse.js';
import { FORBIDDEN_INSUFFICIENT_ROLE } from '../utils/errorCodes.js';

/**
 * Use after requireAuth. Allows only listed roles (e.g. requireRole('admin')).
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const role = req.userRole;
    if (!role || !allowedRoles.includes(role)) {
      return sendError(res, 403, 'Forbidden', FORBIDDEN_INSUFFICIENT_ROLE);
    }
    next();
  };
}
