import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { connectDB } from './config/db.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import clientsRouter from './routes/clients.js';
import appointmentsRouter from './routes/appointments.js';
import bolnaWebhookRouter from './routes/webhooks/bolna.js';
import internalRouter from './routes/internal.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/error.js';

const app = express();
app.set('trust proxy', true);
const port = Number(process.env.PORT) || 3000;

function parseAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS;
  if (raw?.trim()) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [
    'https://regal-mochi-ba82b6.netlify.app',

  ];
}

function isLocalhostOrigin(origin) {
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]'
    );
  } catch {
    return false;
  }
}

const allowedOrigins = parseAllowedOrigins();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (isLocalhostOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(null, allowedOrigins.includes(origin));
    },
  }),
);

/** Set true after Mongo is ready (for health checks). */
let appReady = false;

app.use(express.json());

app.get('/api/health', (req, res) => {
  if (appReady) {
    return res.status(200).json({ ok: true });
  }
  res.status(503).json({ ok: false, starting: true });
});

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/webhooks/bolna', bolnaWebhookRouter);
app.use('/api/internal', internalRouter);

app.use(notFound);
app.use(errorHandler);

function startBootAfterListen() {
  (async () => {
    try {
      await connectDB();
      appReady = true;
      console.log('[boot] dependencies ready');
    } catch (err) {
      console.error('[boot] dependency init failed:', err);
    }
  })();
}

app.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on port ${port}`);
  startBootAfterListen();
});
