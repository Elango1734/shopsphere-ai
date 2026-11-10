import { Router } from 'express';
import {
  productListQuerySchema,
  productSlugParamSchema,
  createProductQuestionSchema,
  answerProductQuestionSchema,
  listQuerySchema,
  compareQuerySchema
} from '@shopsphere/validation';
import { validate } from '../../http/middleware/validate.js';
import { requireAuth, optionalAuth } from '../../http/middleware/auth.js';
import { searchRateLimiter } from '../../http/middleware/rateLimit.js';
import { guestTokenMiddleware } from '../../http/middleware/guestToken.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import * as controller from './catalog.controller.js';

export const catalogRouter = Router();

catalogRouter.get('/categories', asyncHandler(controller.listCategoriesHandler));
catalogRouter.get('/brands', asyncHandler(controller.listBrandsHandler));

catalogRouter.get(
  '/products',
  searchRateLimiter,
  validate('query', productListQuerySchema),
  asyncHandler(controller.listProductsHandler)
);

catalogRouter.get('/products/compare', validate('query', compareQuerySchema), asyncHandler(controller.compareProductsHandler));

catalogRouter.get(
  '/products/:slug',
  validate('params', productSlugParamSchema),
  optionalAuth,
  guestTokenMiddleware,
  asyncHandler(controller.getProductHandler)
);

catalogRouter.get(
  '/products/:slug/reviews',
  validate('params', productSlugParamSchema),
  validate('query', listQuerySchema),
  asyncHandler(controller.listProductReviewsHandler)
);

catalogRouter.get(
  '/products/:slug/questions',
  validate('params', productSlugParamSchema),
  validate('query', listQuerySchema),
  asyncHandler(controller.listQuestionsHandler)
);

catalogRouter.post(
  '/products/:slug/questions',
  validate('params', productSlugParamSchema),
  requireAuth,
  validate('body', createProductQuestionSchema),
  asyncHandler(controller.askQuestionHandler)
);

catalogRouter.post(
  '/questions/:questionId/answers',
  requireAuth,
  validate('body', answerProductQuestionSchema),
  asyncHandler(controller.answerQuestionHandler)
);
