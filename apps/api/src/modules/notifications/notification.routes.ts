import { Router } from 'express';
import { notificationQuerySchema, objectIdParamSchema } from '@shopsphere/validation';
import { validate } from '../../http/middleware/validate.js';
import { requireAuth } from '../../http/middleware/auth.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import * as controller from './notification.controller.js';

export const notificationRouter = Router();
notificationRouter.use(requireAuth);

notificationRouter.get('/', validate('query', notificationQuerySchema), asyncHandler(controller.listHandler));
notificationRouter.post(
  '/:notificationId/read',
  validate('params', objectIdParamSchema('notificationId')),
  asyncHandler(controller.markReadHandler)
);
notificationRouter.post('/read-all', asyncHandler(controller.markAllReadHandler));
