import { Router } from 'express';
import {
  sellerOnboardingSchema,
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
  updateVariantSchema,
  updateInventorySchema,
  updateFulfillmentSchema,
  createShipmentSchema,
  sellerOrderQuerySchema,
  adminAnalyticsQuerySchema,
  objectIdParamSchema
} from '@shopsphere/validation';
import { validate } from '../../http/middleware/validate.js';
import { requireAuth, requireRole } from '../../http/middleware/auth.js';
import { mutationRateLimiter } from '../../http/middleware/rateLimit.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import * as controller from './seller.controller.js';

export const sellerRouter = Router();
sellerRouter.use(requireAuth);

sellerRouter.post('/onboard', validate('body', sellerOnboardingSchema), asyncHandler(controller.onboardHandler));
sellerRouter.get('/me', requireRole('seller'), asyncHandler(controller.getMySellerHandler));

sellerRouter.get('/products', requireRole('seller'), asyncHandler(controller.listMyProductsHandler));
sellerRouter.post(
  '/products',
  requireRole('seller'),
  mutationRateLimiter,
  validate('body', createProductSchema),
  asyncHandler(controller.createProductHandler)
);
sellerRouter.patch(
  '/products/:productId',
  requireRole('seller'),
  validate('params', objectIdParamSchema('productId')),
  validate('body', updateProductSchema),
  asyncHandler(controller.updateProductHandler)
);
sellerRouter.post(
  '/products/:productId/submit',
  requireRole('seller'),
  validate('params', objectIdParamSchema('productId')),
  asyncHandler(controller.submitProductHandler)
);
sellerRouter.get(
  '/products/:productId/variants',
  requireRole('seller'),
  validate('params', objectIdParamSchema('productId')),
  asyncHandler(controller.listVariantsHandler)
);
sellerRouter.post(
  '/products/:productId/variants',
  requireRole('seller'),
  mutationRateLimiter,
  validate('params', objectIdParamSchema('productId')),
  validate('body', createVariantSchema),
  asyncHandler(controller.createVariantHandler)
);

sellerRouter.patch(
  '/variants/:variantId',
  requireRole('seller'),
  validate('params', objectIdParamSchema('variantId')),
  validate('body', updateVariantSchema),
  asyncHandler(controller.updateVariantHandler)
);
sellerRouter.patch(
  '/variants/:variantId/inventory',
  requireRole('seller'),
  validate('params', objectIdParamSchema('variantId')),
  validate('body', updateInventorySchema),
  asyncHandler(controller.updateInventoryHandler)
);

sellerRouter.get('/inventory/low-stock', requireRole('seller'), asyncHandler(controller.lowStockHandler));

sellerRouter.get(
  '/analytics/overview',
  requireRole('seller'),
  validate('query', adminAnalyticsQuerySchema),
  asyncHandler(controller.getMyAnalyticsHandler)
);

sellerRouter.get(
  '/orders',
  requireRole('seller'),
  validate('query', sellerOrderQuerySchema),
  asyncHandler(controller.listSellerOrdersHandler)
);
sellerRouter.get(
  '/orders/:orderId',
  requireRole('seller'),
  validate('params', objectIdParamSchema('orderId')),
  asyncHandler(controller.getSellerOrderHandler)
);
sellerRouter.patch(
  '/orders/:orderId/fulfillment',
  requireRole('seller'),
  validate('params', objectIdParamSchema('orderId')),
  validate('body', updateFulfillmentSchema),
  asyncHandler(controller.updateFulfillmentHandler)
);
sellerRouter.post(
  '/orders/:orderId/shipments',
  requireRole('seller'),
  validate('params', objectIdParamSchema('orderId')),
  validate('body', createShipmentSchema),
  asyncHandler(controller.createShipmentHandler)
);
