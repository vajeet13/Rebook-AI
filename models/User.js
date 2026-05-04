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

const userSchema = new mongoose.Schema(
  {
    firstName: nonEmptyString,
    lastName: nonEmptyString,
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    profilePic: { type: String, default: null },
    role: {
      type: String,
      enum: ['admin', 'user'],
      default: 'user',
    },
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
