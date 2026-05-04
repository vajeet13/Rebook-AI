import mongoose from 'mongoose';

const voiceExecutionLogSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    executionId: { type: String, required: true },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
    },
    payload: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

voiceExecutionLogSchema.index({ ownerId: 1, executionId: 1 }, { unique: true });

export const VoiceExecutionLog = mongoose.model('VoiceExecutionLog', voiceExecutionLogSchema);
