import { Router, raw } from 'express';
import { asyncHandler } from '../../http/asyncHandler.js';
import * as controller from './webhook.controller.js';

export const webhookRouter = Router();

// Raw body is required for signature verification — this router must be mounted BEFORE the global JSON
// body parser in app.ts, so it never gets re-parsed/re-serialized before the signature check runs.
webhookRouter.post('/payments/:provider', raw({ type: '*/*', limit: '256kb' }), asyncHandler(controller.paymentWebhookHandler));
