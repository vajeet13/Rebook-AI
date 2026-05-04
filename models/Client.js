import mongoose from 'mongoose';

const nonEmptyString = {
  type: String,
  required: true,
  trim: true,
  validate: {
    validator(v) {
      return typeof v === 'string' && v.length > 0;
    },
    message: 'cannot be empty',
  },
};

const clientSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    firstName: nonEmptyString,
    lastName: nonEmptyString,
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    email: { type: String, default: null, lowercase: true, trim: true },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

clientSchema.index({ ownerId: 1, phone: 1 }, { unique: true });

export const Client = mongoose.model('Client', clientSchema);
