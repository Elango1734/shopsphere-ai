import { Router } from 'express';
import { createReviewSchema } from '@shopsphere/validation';
import { validate } from '../../http/middleware/validate.js';
import { requireAuth } from '../../http/middleware/auth.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import * as controller from './review.controller.js';

export const reviewRouter = Router();
reviewRouter.post('/', requireAuth, validate('body', createReviewSchema), asyncHandler(controller.createReviewHandler));
