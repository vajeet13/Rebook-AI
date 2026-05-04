import mongoose from 'mongoose';
import { Client } from '../models/Client.js';
import { WaitlistEntry } from '../models/WaitlistEntry.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { WAITLIST_FIELDS_REQUIRED, WAITLIST_CLIENT_INVALID } from '../utils/errorCodes.js';
import { toOwnerObjectId } from '../utils/ownerId.js';

function waitlistPublic(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: o._id.toString(),
    ownerId: o.ownerId?.toString?.() ?? String(o.ownerId),
    clientId: o.clientId?.toString?.() ?? String(o.clientId),
    serviceId: o.serviceId ?? null,
    resourceId: o.resourceId ?? null,
    status: o.status,
    joinedAt: o.joinedAt,
    preferredWindowStart: o.preferredWindowStart ?? null,
    preferredWindowEnd: o.preferredWindowEnd ?? null,
    preferredStartsAt: o.preferredStartsAt ?? null,
    fulfilledAppointmentId: o.fulfilledAppointmentId?.toString?.() ?? null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

export async function joinWaitlist(req, res) {
  const ownerId = toOwnerObjectId(req.userId);
  if (!ownerId) {
    return sendError(res, 400, 'Invalid session', WAITLIST_FIELDS_REQUIRED);
  }

  const clientId = req.body?.clientId;
  if (!clientId || !mongoose.isValidObjectId(String(clientId))) {
    return sendError(res, 400, 'clientId is required', WAITLIST_FIELDS_REQUIRED);
  }

  const client = await Client.findOne({ _id: clientId, ownerId }).lean();
  if (!client) {
    return sendError(res, 400, 'Client is not valid for this account', WAITLIST_CLIENT_INVALID);
  }

  const serviceId = req.body?.serviceId != null ? String(req.body.serviceId).trim() || null : null;
  const resourceId = req.body?.resourceId != null ? String(req.body.resourceId).trim() || null : null;

  let preferredWindowStart = null;
  let preferredWindowEnd = null;
  let preferredStartsAt = null;

  if (req.body?.preferredWindowStart != null && req.body?.preferredWindowEnd != null) {
    preferredWindowStart = new Date(req.body.preferredWindowStart);
    preferredWindowEnd = new Date(req.body.preferredWindowEnd);
    if (
      Number.isNaN(preferredWindowStart.getTime()) ||
      Number.isNaN(preferredWindowEnd.getTime())
    ) {
      return sendError(res, 400, 'Invalid preferred window dates', WAITLIST_FIELDS_REQUIRED);
    }
  }

  if (req.body?.preferredStartsAt != null) {
    preferredStartsAt = new Date(req.body.preferredStartsAt);
    if (Number.isNaN(preferredStartsAt.getTime())) {
      return sendError(res, 400, 'Invalid preferredStartsAt', WAITLIST_FIELDS_REQUIRED);
    }
  }

  const entry = await WaitlistEntry.create({
    ownerId,
    clientId: client._id,
    serviceId,
    resourceId,
    status: 'active',
    preferredWindowStart,
    preferredWindowEnd,
    preferredStartsAt,
  });

  return sendSuccess(res, { waitlistEntry: waitlistPublic(entry) }, 201);
}

export async function listWaitlist(req, res) {
  const ownerId = toOwnerObjectId(req.userId);
  if (!ownerId) {
    return sendError(res, 400, 'Invalid session', WAITLIST_FIELDS_REQUIRED);
  }
  const status = req.query?.status ? String(req.query.status) : undefined;
  const q = { ownerId };
  if (status) q.status = status;
  const rows = await WaitlistEntry.find(q).sort({ joinedAt: 1 }).limit(100).lean();
  return sendSuccess(res, { waitlistEntries: rows.map((r) => waitlistPublic(r)) });
}
