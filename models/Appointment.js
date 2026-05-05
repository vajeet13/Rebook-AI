import mongoose from 'mongoose';

const voiceOutcomeSchema = new mongoose.Schema(
  {
    lastExecutionId: { type: String, default: null },
    rawStatus: { type: String, default: null },
    summary: { type: String, default: null },
    transcript: { type: String, default: null },
    extractedData: { type: mongoose.Schema.Types.Mixed, default: null },
    contextDetails: { type: mongoose.Schema.Types.Mixed, default: null },
    callSummary: { type: String, default: null },
    cancellationReason: { type: String, default: null },
    resolvedOutcome: {
      type: String,
      enum: ['confirmed', 'cancelled', 'reschedule_requested', 'no_answer', 'unknown'],
      default: null,
    },
    updatedAt: { type: Date, default: null },
  },
  { _id: false }
);

const appointmentSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
      index: true,
    },
    contactPhone: { type: String, default: null, trim: true },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true },
    serviceId: { type: String, default: null, trim: true, index: true },
    resourceId: { type: String, default: null, trim: true, index: true },
    status: {
      type: String,
      enum: ['scheduled', 'pending_confirmation', 'confirmed', 'cancelled', 'rescheduled', 'completed'],
      default: 'scheduled',
      index: true,
    },
    previousStartsAt: { type: Date, default: null },
    previousEndsAt: { type: Date, default: null },
    rescheduledAt: { type: Date, default: null },
    lastBolnaExecutionId: { type: String, default: null },
    recoveryCallScheduledFor: { type: Date, default: null },
    voiceOutcome: { type: voiceOutcomeSchema, default: () => ({}) },
  },
  { timestamps: true }
);

appointmentSchema.index({ ownerId: 1, startsAt: 1 });
appointmentSchema.index({ ownerId: 1, status: 1, startsAt: 1 });
appointmentSchema.index({ ownerId: 1, clientId: 1 });

export const Appointment = mongoose.model('Appointment', appointmentSchema);
