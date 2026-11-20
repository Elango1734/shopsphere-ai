import { Router } from 'express';
import { recordEventsSchema } from '@shopsphere/validation';
import { validate } from '../../http/middleware/validate.js';
import { optionalAuth } from '../../http/middleware/auth.js';
import { guestTokenMiddleware } from '../../http/middleware/guestToken.js';
import { eventRateLimiter } from '../../http/middleware/rateLimit.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import * as controller from './analytics.controller.js';

export const analyticsRouter = Router();

// Open to guests by design — the whole point is measuring people who never sign in.
// Its own rate limit: a storefront sends far more events than it does mutations,
// and a burst of tracking must never eat the mutation budget (rateLimit.ts).
analyticsRouter.post(
  '/events',
  optionalAuth,
  guestTokenMiddleware,
  eventRateLimiter,
  validate('body', recordEventsSchema),
  asyncHandler(controller.recordEventsHandler)
);
