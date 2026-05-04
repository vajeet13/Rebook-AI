import mongoose from 'mongoose';
import { Appointment } from '../models/Appointment.js';
import { Client } from '../models/Client.js';
import { WaitlistEntry } from '../models/WaitlistEntry.js';

function windowIntersects(entry, freedSlotStart, freedSlotEnd) {
  if (!entry.preferredWindowStart || !entry.preferredWindowEnd) return true;
  const a = new Date(entry.preferredWindowStart).getTime();
  const b = new Date(entry.preferredWindowEnd).getTime();
  const fs = freedSlotStart.getTime();
  const fe = freedSlotEnd.getTime();
  return !(fe < a || fs > b);
}

function rankKey(entry, freedSlotStart) {
  const join = new Date(entry.joinedAt).getTime();
  let dist = 0;
  if (entry.preferredStartsAt) {
    dist = Math.abs(new Date(entry.preferredStartsAt).getTime() - freedSlotStart.getTime());
  } else if (entry.preferredWindowStart && entry.preferredWindowEnd) {
    const mid =
      (new Date(entry.preferredWindowStart).getTime() +
        new Date(entry.preferredWindowEnd).getTime()) /
      2;
    dist = Math.abs(mid - freedSlotStart.getTime());
  }
  return { join, dist };
}

/**
 * @param {object} params
 * @param {import('mongoose').Types.ObjectId} params.ownerId
 * @param {string|null} params.serviceId
 * @param {string|null} params.resourceId
 * @param {Date} params.freedSlotStart
 * @param {Date} params.freedSlotEnd
 * @param {import('mongoose').Types.ObjectId|null} [params.sourceAppointmentId]
 */
export async function tryFillSlot({
  ownerId,
  serviceId,
  resourceId,
  freedSlotStart,
  freedSlotEnd,
  sourceAppointmentId = null,
}) {
  if (sourceAppointmentId) {
    const existing = await Appointment.findById(sourceAppointmentId).select('recoveryFilledByAppointmentId').lean();
    if (existing?.recoveryFilledByAppointmentId) {
      return { filled: false };
    }
  }

  const query = {
    ownerId,
    status: 'active',
    serviceId: serviceId == null || serviceId === '' ? null : serviceId,
    resourceId: resourceId == null || resourceId === '' ? null : resourceId,
  };

  const candidates = await WaitlistEntry.find(query).limit(80).lean();

  const filtered = candidates.filter((e) => windowIntersects(e, freedSlotStart, freedSlotEnd));
  filtered.sort((a, b) => {
    const ra = rankKey(a, freedSlotStart);
    const rb = rankKey(b, freedSlotStart);
    if (ra.join !== rb.join) return ra.join - rb.join;
    return ra.dist - rb.dist;
  });

  const durationMs = Math.max(0, freedSlotEnd.getTime() - freedSlotStart.getTime());

  for (const entry of filtered) {
    const client = await Client.findOne({ _id: entry.clientId, ownerId }).lean();
    if (!client) continue;

    try {
      const newAppt = await Appointment.create({
        ownerId,
        clientId: entry.clientId,
        contactPhone: client.phone ?? null,
        startsAt: freedSlotStart,
        endsAt: new Date(freedSlotStart.getTime() + durationMs),
        serviceId: entry.serviceId ?? null,
        resourceId: entry.resourceId ?? null,
        status: 'scheduled',
        recoveredFromWaitlistEntryId: new mongoose.Types.ObjectId(String(entry._id)),
      });

      const upd = await WaitlistEntry.findOneAndUpdate(
        { _id: entry._id, status: 'active' },
        {
          $set: {
            status: 'fulfilled',
            fulfilledAppointmentId: newAppt._id,
            offeredAt: new Date(),
          },
        },
        { new: true }
      );

      if (!upd) {
        await Appointment.deleteOne({ _id: newAppt._id });
        continue;
      }

      if (sourceAppointmentId) {
        await Appointment.findByIdAndUpdate(sourceAppointmentId, {
          $set: { recoveryFilledByAppointmentId: newAppt._id },
        });
      }

      return { filled: true, appointment: newAppt, waitlistEntry: upd };
    } catch {
      // try next candidate
    }
  }

  return { filled: false };
}

export async function tryFillSlotFromFreedAppointment(appointmentDoc) {
  if (!appointmentDoc || appointmentDoc.status !== 'cancelled') {
    return { filled: false };
  }
  return tryFillSlot({
    ownerId: appointmentDoc.ownerId,
    serviceId: appointmentDoc.serviceId ?? null,
    resourceId: appointmentDoc.resourceId ?? null,
    freedSlotStart: appointmentDoc.startsAt,
    freedSlotEnd: appointmentDoc.endsAt,
    sourceAppointmentId: appointmentDoc._id,
  });
}
