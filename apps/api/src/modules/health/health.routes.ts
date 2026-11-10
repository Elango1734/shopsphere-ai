import { Router } from 'express';
import mongoose from 'mongoose';
import { sendSuccess } from '../../http/envelope.js';

export const healthRouter = Router();

/** Liveness: the process is up and able to respond, independent of downstream dependencies. */
healthRouter.get('/health', (_req, res) => {
  sendSuccess(res, { status: 'ok' });
});

/** Readiness: the process is additionally ready to serve traffic that needs the database. */
healthRouter.get('/ready', (_req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  sendSuccess(res, { status: dbReady ? 'ready' : 'not_ready', database: dbReady }, { status: dbReady ? 200 : 503 });
});
