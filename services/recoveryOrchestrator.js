import * as waitlistService from './waitlistService.js';

/**
 * @param {import('../models/Appointment.js').Appointment} appointmentDoc
 */
export async function onCancellation(appointmentDoc) {
  return waitlistService.tryFillSlotFromFreedAppointment(appointmentDoc);
}

/**
 * @param {import('../models/Appointment.js').Appointment} appointmentDoc
 * @param {Date} oldStartsAt
 * @param {Date} oldEndsAt
 */
export async function onRescheduleReleasedSlot(appointmentDoc, oldStartsAt, oldEndsAt) {
  if (!appointmentDoc?.offerReleasedSlotToWaitlist) {
    return { filled: false };
  }
  return waitlistService.tryFillSlot({
    ownerId: appointmentDoc.ownerId,
    serviceId: appointmentDoc.serviceId ?? null,
    resourceId: appointmentDoc.resourceId ?? null,
    freedSlotStart: oldStartsAt,
    freedSlotEnd: oldEndsAt,
    sourceAppointmentId: appointmentDoc._id,
  });
}
