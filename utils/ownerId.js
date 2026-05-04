import mongoose from 'mongoose';

export function toOwnerObjectId(userId) {
  if (userId == null || !mongoose.isValidObjectId(userId)) {
    return null;
  }
  return new mongoose.Types.ObjectId(String(userId));
}
