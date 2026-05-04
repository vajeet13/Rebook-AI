/**
 * Central MongoDB settings for Rebook AI.
 * Default database name is `users`; override with MONGO_DB_NAME in .env.
 * Add future connection-scoped options here (pool size, read preference, etc.).
 */

const DEFAULT_DB_NAME = 'data';

function resolveDbName() {
  const fromEnv = process.env.MONGO_DB_NAME;
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') {
    return fromEnv.trim();
  }
  return DEFAULT_DB_NAME;
}

export const mongoConfig = {
  /** Database name used when connecting (see mongoose connect `dbName`). */
  dbName: resolveDbName(),

  /** Defaults passed to mongoose.connect — extend as the app grows. */
  connectOptions: {
    serverSelectionTimeoutMS: 15_000,
    connectTimeoutMS: 15_000,
  },
};
