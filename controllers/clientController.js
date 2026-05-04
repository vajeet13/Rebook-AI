import mongoose from 'mongoose';
import { Client } from '../models/Client.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import {
  CLIENT_NOT_FOUND,
  CLIENT_FIELDS_REQUIRED,
  CLIENT_DUPLICATE_PHONE,
} from '../utils/errorCodes.js';
import { toOwnerObjectId } from '../utils/ownerId.js';

function trimOrEmpty(v) {
  if (v == null) return '';
  return String(v).trim();
}

export function clientPublic(doc) {
  return {
    id: doc._id.toString(),
    firstName: doc.firstName,
    lastName: doc.lastName,
    phone: doc.phone,
    email: doc.email ?? null,
    notes: doc.notes ?? '',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function createClient(req, res) {
  const ownerId = toOwnerObjectId(req.userId);
  if (!ownerId) {
    return sendError(res, 400, 'Invalid session', CLIENT_FIELDS_REQUIRED);
  }

  const firstName = trimOrEmpty(req.body?.firstName);
  const lastName = trimOrEmpty(req.body?.lastName);
  const phone = trimOrEmpty(req.body?.phone);
  const email = trimOrEmpty(req.body?.email);
  const notes = req.body?.notes != null ? String(req.body.notes) : '';

  if (!firstName || !lastName || !phone) {
    return sendError(
      res,
      400,
      'firstName, lastName, and phone are required',
      CLIENT_FIELDS_REQUIRED,
    );
  }

  try {
    const client = await Client.create({
      ownerId,
      firstName,
      lastName,
      phone,
      email: email || null,
      notes,
    });
    return sendSuccess(res, { client: clientPublic(client) }, 201);
  } catch (err) {
    if (err.code === 11000) {
      return sendError(res, 409, 'A client with this phone already exists', CLIENT_DUPLICATE_PHONE);
    }
    throw err;
  }
}

export async function listClients(req, res) {
  const ownerId = toOwnerObjectId(req.userId);
  if (!ownerId) {
    return sendError(res, 400, 'Invalid session', CLIENT_FIELDS_REQUIRED);
  }
  const clients = await Client.find({ ownerId }).sort({ createdAt: -1 }).lean();
  return sendSuccess(res, { clients: clients.map((c) => clientPublic(c)) });
}

export async function getClientById(req, res) {
  const ownerId = toOwnerObjectId(req.userId);
  if (!ownerId) {
    return sendError(res, 400, 'Invalid session', CLIENT_FIELDS_REQUIRED);
  }
  const { clientId } = req.params;
  if (!mongoose.isValidObjectId(clientId)) {
    return sendError(res, 404, 'Client not found', CLIENT_NOT_FOUND);
  }
  const client = await Client.findOne({ _id: clientId, ownerId }).lean();
  if (!client) {
    return sendError(res, 404, 'Client not found', CLIENT_NOT_FOUND);
  }
  return sendSuccess(res, { client: clientPublic(client) });
}

export async function patchClient(req, res) {
  const ownerId = toOwnerObjectId(req.userId);
  if (!ownerId) {
    return sendError(res, 400, 'Invalid session', CLIENT_FIELDS_REQUIRED);
  }
  const { clientId } = req.params;
  if (!mongoose.isValidObjectId(clientId)) {
    return sendError(res, 404, 'Client not found', CLIENT_NOT_FOUND);
  }

  const updates = {};
  if (Object.prototype.hasOwnProperty.call(req.body, 'firstName')) {
    const v = trimOrEmpty(req.body.firstName);
    if (!v) {
      return sendError(res, 400, 'firstName cannot be empty', CLIENT_FIELDS_REQUIRED);
    }
    updates.firstName = v;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'lastName')) {
    const v = trimOrEmpty(req.body.lastName);
    if (!v) {
      return sendError(res, 400, 'lastName cannot be empty', CLIENT_FIELDS_REQUIRED);
    }
    updates.lastName = v;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'phone')) {
    const v = trimOrEmpty(req.body.phone);
    if (!v) {
      return sendError(res, 400, 'phone cannot be empty', CLIENT_FIELDS_REQUIRED);
    }
    updates.phone = v;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'email')) {
    const v = trimOrEmpty(req.body.email);
    updates.email = v || null;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'notes')) {
    updates.notes = req.body.notes != null ? String(req.body.notes) : '';
  }

  if (Object.keys(updates).length === 0) {
    return sendError(res, 400, 'No fields to update', CLIENT_FIELDS_REQUIRED);
  }

  try {
    const client = await Client.findOneAndUpdate(
      { _id: clientId, ownerId },
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!client) {
      return sendError(res, 404, 'Client not found', CLIENT_NOT_FOUND);
    }
    return sendSuccess(res, { client: clientPublic(client) });
  } catch (err) {
    if (err.code === 11000) {
      return sendError(res, 409, 'A client with this phone already exists', CLIENT_DUPLICATE_PHONE);
    }
    throw err;
  }
}
