import { Router } from 'express';
import { checkoutInputSchema } from '@shopsphere/validation';
import { validate } from '../../http/middleware/validate.js';
import { requireAuth } from '../../http/middleware/auth.js';
import { checkoutRateLimiter } from '../../http/middleware/rateLimit.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import * as controller from './checkout.controller.js';

export const checkoutRouter = Router();
checkoutRouter.post(
  '/',
  requireAuth,
  checkoutRateLimiter,
  validate('body', checkoutInputSchema),
  asyncHandler(controller.checkoutHandler)
);
