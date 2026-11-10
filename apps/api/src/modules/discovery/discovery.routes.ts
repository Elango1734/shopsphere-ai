import { Router } from 'express';
import { toggleWishlistSchema } from '@shopsphere/validation';
import { validate } from '../../http/middleware/validate.js';
import { requireAuth, optionalAuth } from '../../http/middleware/auth.js';
import { guestTokenMiddleware } from '../../http/middleware/guestToken.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import * as controller from './discovery.controller.js';

export const discoveryRouter = Router();

discoveryRouter.get('/wishlist', requireAuth, asyncHandler(controller.getWishlistHandler));
discoveryRouter.post(
  '/wishlist/toggle',
  requireAuth,
  validate('body', toggleWishlistSchema),
  asyncHandler(controller.toggleWishlistHandler)
);

discoveryRouter.get(
  '/recently-viewed',
  optionalAuth,
  guestTokenMiddleware,
  asyncHandler(controller.getRecentlyViewedHandler)
);
