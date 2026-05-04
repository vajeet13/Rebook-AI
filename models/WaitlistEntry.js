import mongoose from 'mongoose';

const waitlistEntrySchema = new mongoose.Schema(
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
    serviceId: { type: String, default: null, trim: true, index: true },
    resourceId: { type: String, default: null, trim: true, index: true },
    status: {
      type: String,
      enum: ['active', 'offered', 'fulfilled', 'withdrawn'],
      default: 'active',
      index: true,
    },
    joinedAt: { type: Date, default: () => new Date(), index: true },
    preferredWindowStart: { type: Date, default: null },
    preferredWindowEnd: { type: Date, default: null },
    preferredStartsAt: { type: Date, default: null },
    fulfilledAppointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
    },
    offeredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

waitlistEntrySchema.index({ ownerId: 1, status: 1, joinedAt: 1 });

export const WaitlistEntry = mongoose.model('WaitlistEntry', waitlistEntrySchema);
