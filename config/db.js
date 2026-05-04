import dns from 'dns';
import mongoose from 'mongoose';
import { mongoConfig } from './mongo.config.js';

export async function connectDB() {
  const uri =
    typeof process.env.MONGO_URI === 'string' ? process.env.MONGO_URI.trim() : '';
  if (!uri) {
    throw new Error('MONGO_URI is not set');
  }

  // Fixes querySrv ECONNREFUSED on some Windows setups when SRV lookups fail on system DNS.
  const dnsServers = process.env.MONGODB_DNS_SERVERS;
  if (dnsServers) {
    dns.setServers(
      dnsServers
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    );
  }

  mongoose.connection.on('connected', () => {
    console.log(`[mongo] connected ${mongoose.connection.host} db=${mongoose.connection.name}`);
  });

  mongoose.connection.on('error', (err) => {
    console.error('[mongo] error', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[mongo] disconnected');
  });

  await mongoose.connect(uri, {
    ...mongoConfig.connectOptions,
    dbName: mongoConfig.dbName,
  });
}
