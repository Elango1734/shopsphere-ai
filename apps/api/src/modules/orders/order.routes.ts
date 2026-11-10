import { Router } from 'express';
import { listQuerySchema, returnRequestInputSchema } from '@shopsphere/validation';
import { validate } from '../../http/middleware/validate.js';
import { requireAuth } from '../../http/middleware/auth.js';
import { mutationRateLimiter } from '../../http/middleware/rateLimit.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import * as controller from './order.controller.js';

export const orderRouter = Router();
orderRouter.use(requireAuth);

orderRouter.get('/', validate('query', listQuerySchema), asyncHandler(controller.listOrdersHandler));
orderRouter.get('/:orderId', asyncHandler(controller.getOrderHandler));
orderRouter.post('/:orderId/cancel', mutationRateLimiter, asyncHandler(controller.cancelOrderHandler));
orderRouter.get('/:orderId/shipments', asyncHandler(controller.listOrderShipmentsHandler));

export const returnRouter = Router();
returnRouter.use(requireAuth);
returnRouter.get('/', validate('query', listQuerySchema), asyncHandler(controller.listReturnsHandler));
returnRouter.post('/', validate('body', returnRequestInputSchema), asyncHandler(controller.createReturnHandler));
returnRouter.get('/:returnId', asyncHandler(controller.getReturnHandler));
