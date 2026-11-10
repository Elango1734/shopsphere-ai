import { Router } from 'express';
import { addCartItemSchema, updateCartItemSchema, variantIdParamSchema } from '@shopsphere/validation';
import { validate } from '../../http/middleware/validate.js';
import { optionalAuth } from '../../http/middleware/auth.js';
import { guestTokenMiddleware } from '../../http/middleware/guestToken.js';
import { mutationRateLimiter } from '../../http/middleware/rateLimit.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import * as controller from './cart.controller.js';

export const cartRouter = Router();
cartRouter.use(optionalAuth, guestTokenMiddleware);

cartRouter.get('/', asyncHandler(controller.getCartHandler));
cartRouter.post('/items', mutationRateLimiter, validate('body', addCartItemSchema), asyncHandler(controller.addItemHandler));
cartRouter.patch(
  '/items/:variantId',
  validate('params', variantIdParamSchema),
  validate('body', updateCartItemSchema),
  asyncHandler(controller.updateItemHandler)
);
cartRouter.delete('/items/:variantId', validate('params', variantIdParamSchema), asyncHandler(controller.removeItemHandler));
