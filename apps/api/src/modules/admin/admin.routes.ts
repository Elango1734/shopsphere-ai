import { Router } from 'express';
import {
  adminUserQuerySchema,
  adminSellerQuerySchema,
  adminOrderQuerySchema,
  adminReturnQuerySchema,
  listQuerySchema,
  changeUserStatusSchema,
  changeSellerStatusSchema,
  createCategorySchema,
  createBrandSchema,
  moderateProductSchema,
  reviewReturnRequestSchema,
  processRefundSchema,
  reviewModerationSchema,
  createCouponSchema,
  objectIdParamSchema,
  adminAnalyticsQuerySchema,
  adminProductQuerySchema
} from '@shopsphere/validation';
import { validate } from '../../http/middleware/validate.js';
import { requireAuth, requireRole } from '../../http/middleware/auth.js';
import { mutationRateLimiter } from '../../http/middleware/rateLimit.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import * as controller from './admin.controller.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('administrator'));

adminRouter.get('/analytics/overview', validate('query', adminAnalyticsQuerySchema), asyncHandler(controller.getAnalyticsHandler));

adminRouter.get('/users', validate('query', adminUserQuerySchema), asyncHandler(controller.listUsersHandler));
adminRouter.get('/users/:userId', validate('params', objectIdParamSchema('userId')), asyncHandler(controller.getUserHandler));
adminRouter.patch(
  '/users/:userId/status',
  validate('params', objectIdParamSchema('userId')),
  validate('body', changeUserStatusSchema),
  asyncHandler(controller.changeUserStatusHandler)
);

adminRouter.get('/sellers', validate('query', adminSellerQuerySchema), asyncHandler(controller.listSellersHandler));
adminRouter.get('/sellers/:sellerId', validate('params', objectIdParamSchema('sellerId')), asyncHandler(controller.getSellerHandler));
adminRouter.patch(
  '/sellers/:sellerId/status',
  validate('params', objectIdParamSchema('sellerId')),
  validate('body', changeSellerStatusSchema),
  asyncHandler(controller.changeSellerStatusHandler)
);

adminRouter.post('/categories', mutationRateLimiter, validate('body', createCategorySchema), asyncHandler(controller.createCategoryHandler));
adminRouter.post('/brands', mutationRateLimiter, validate('body', createBrandSchema), asyncHandler(controller.createBrandHandler));

adminRouter.get('/products', validate('query', adminProductQuerySchema), asyncHandler(controller.listProductsHandler));
adminRouter.patch(
  '/products/:productId/moderate',
  validate('params', objectIdParamSchema('productId')),
  validate('body', moderateProductSchema),
  asyncHandler(controller.moderateProductHandler)
);

adminRouter.get('/orders', validate('query', adminOrderQuerySchema), asyncHandler(controller.searchOrdersHandler));
adminRouter.get('/orders/:orderId', validate('params', objectIdParamSchema('orderId')), asyncHandler(controller.getOrderHandler));
adminRouter.get(
  '/orders/:orderId/payment-attempts',
  validate('params', objectIdParamSchema('orderId')),
  asyncHandler(controller.listPaymentAttemptsHandler)
);

adminRouter.get('/returns', validate('query', adminReturnQuerySchema), asyncHandler(controller.listReturnsHandler));
adminRouter.patch(
  '/returns/:returnId/review',
  validate('params', objectIdParamSchema('returnId')),
  validate('body', reviewReturnRequestSchema),
  asyncHandler(controller.reviewReturnHandler)
);

adminRouter.post('/refunds', mutationRateLimiter, validate('body', processRefundSchema), asyncHandler(controller.processRefundHandler));

adminRouter.patch(
  '/reviews/:reviewId/moderate',
  validate('params', objectIdParamSchema('reviewId')),
  validate('body', reviewModerationSchema),
  asyncHandler(controller.moderateReviewHandler)
);

adminRouter.get('/coupons', validate('query', listQuerySchema), asyncHandler(controller.listCouponsHandler));
adminRouter.post('/coupons', mutationRateLimiter, validate('body', createCouponSchema), asyncHandler(controller.createCouponHandler));

adminRouter.get('/audit-logs', validate('query', listQuerySchema), asyncHandler(controller.listAuditLogsHandler));

adminRouter.get('/ai/overview', asyncHandler(controller.getAiOverviewHandler));
adminRouter.get('/ai/conversations', validate('query', listQuerySchema), asyncHandler(controller.listAiConversationsHandler));
adminRouter.get(
  '/ai/conversations/:conversationId',
  validate('params', objectIdParamSchema('conversationId')),
  asyncHandler(controller.getAiConversationHandler)
);
