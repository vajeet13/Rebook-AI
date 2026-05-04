import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { BCRYPT_ROUNDS, userPublic } from './authController.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import {
  USER_ID_INVALID,
  USER_NOT_FOUND,
  PROFILE_UPDATE_NO_FIELDS,
  PROFILE_NAME_FIELDS_EMPTY,
  PASSWORD_UPDATE_FIELDS_REQUIRED,
  CURRENT_PASSWORD_INCORRECT,
  NEW_PASSWORD_SAME_AS_CURRENT,
} from '../utils/errorCodes.js';

function trimOrEmpty(v) {
  if (v == null) return '';
  return String(v).trim();
}

export async function updateMyProfile(req, res) {
  const hasFirst = req.body != null && Object.prototype.hasOwnProperty.call(req.body, 'firstName');
  const hasLast = req.body != null && Object.prototype.hasOwnProperty.call(req.body, 'lastName');
  if (!hasFirst && !hasLast) {
    return sendError(
      res,
      400,
      'Provide at least one of firstName or lastName',
      PROFILE_UPDATE_NO_FIELDS,
    );
  }

  const updates = {};
  if (hasFirst) {
    const firstName = trimOrEmpty(req.body.firstName);
    if (!firstName) {
      return sendError(
        res,
        400,
        'firstName and lastName cannot be empty',
        PROFILE_NAME_FIELDS_EMPTY,
      );
    }
    updates.firstName = firstName;
  }
  if (hasLast) {
    const lastName = trimOrEmpty(req.body.lastName);
    if (!lastName) {
      return sendError(
        res,
        400,
        'firstName and lastName cannot be empty',
        PROFILE_NAME_FIELDS_EMPTY,
      );
    }
    updates.lastName = lastName;
  }

  const user = await User.findByIdAndUpdate(req.userId, { $set: updates }, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!user) {
    return sendError(res, 404, 'User not found', USER_NOT_FOUND);
  }
  return sendSuccess(res, { user: userPublic(user) });
}

export async function updatePassword(req, res) {
  const currentPassword = trimOrEmpty(req.body?.currentPassword);
  const newPassword = trimOrEmpty(req.body?.newPassword);

  if (!currentPassword || !newPassword) {
    return sendError(
      res,
      400,
      'currentPassword and newPassword are required',
      PASSWORD_UPDATE_FIELDS_REQUIRED,
    );
  }

  const user = await User.findById(req.userId).select('+passwordHash');
  if (!user) {
    return sendError(res, 404, 'User not found', USER_NOT_FOUND);
  }

  const currentOk = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!currentOk) {
    return sendError(res, 401, 'Current password is incorrect', CURRENT_PASSWORD_INCORRECT);
  }

  const sameAsCurrent = await bcrypt.compare(newPassword, user.passwordHash);
  if (sameAsCurrent) {
    return sendError(
      res,
      400,
      'New password must be different from the current password',
      NEW_PASSWORD_SAME_AS_CURRENT,
    );
  }

  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await user.save();

  return sendSuccess(res, { passwordUpdated: true });
}

export async function getUserDetails(req, res) {
  const user = await User.findById(req.userId);
  if (!user) {
    return sendError(res, 404, 'User not found', USER_NOT_FOUND);
  }
  return sendSuccess(res, { user: userPublic(user) });
}

export async function getUserById(req, res) {
  const { userId } = req.params;
  if (!mongoose.isValidObjectId(userId)) {
    return sendError(res, 400, 'Invalid user id', USER_ID_INVALID);
  }
  const user = await User.findById(userId);
  if (!user) {
    return sendError(res, 404, 'User not found', USER_NOT_FOUND);
  }
  return sendSuccess(res, { user: userPublic(user) });
}

export async function listUsers(req, res) {
  const users = await User.find({}).sort({ createdAt: -1 }).lean();
  return sendSuccess(res, { users: users.map((u) => userPublic(u)) });
}
