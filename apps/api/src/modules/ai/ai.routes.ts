import { Router } from 'express';
import { aiDiscoverySchema, aiCompareSchema, aiSupportSchema, objectIdParamSchema, productSlugParamSchema } from '@shopsphere/validation';
import { validate } from '../../http/middleware/validate.js';
import { optionalAuth } from '../../http/middleware/auth.js';
import { guestTokenMiddleware } from '../../http/middleware/guestToken.js';
import { aiRateLimiter } from '../../http/middleware/rateLimit.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import * as controller from './ai.controller.js';

export const aiRouter = Router();
aiRouter.use(optionalAuth, guestTokenMiddleware, aiRateLimiter);

aiRouter.post('/discovery', validate('body', aiDiscoverySchema), asyncHandler(controller.discoveryHandler));
aiRouter.post('/compare', validate('body', aiCompareSchema), asyncHandler(controller.compareHandler));
aiRouter.post('/support', validate('body', aiSupportSchema), asyncHandler(controller.supportHandler));
aiRouter.get(
  '/conversations/:conversationId',
  validate('params', objectIdParamSchema('conversationId')),
  asyncHandler(controller.getHistoryHandler)
);
aiRouter.delete(
  '/conversations/:conversationId',
  validate('params', objectIdParamSchema('conversationId')),
  asyncHandler(controller.deleteHistoryHandler)
);

aiRouter.get(
  '/products/:slug/related',
  validate('params', productSlugParamSchema),
  asyncHandler(controller.relatedProductsHandler)
);
aiRouter.get(
  '/products/:slug/review-summary',
  validate('params', productSlugParamSchema),
  asyncHandler(controller.reviewSummaryHandler)
);
