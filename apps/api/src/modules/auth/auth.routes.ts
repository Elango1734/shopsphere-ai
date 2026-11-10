import { Router } from 'express';
import { registerSchema, loginSchema, changePasswordSchema } from '@shopsphere/validation';
import { validate } from '../../http/middleware/validate.js';
import { requireAuth } from '../../http/middleware/auth.js';
import { guestTokenMiddleware } from '../../http/middleware/guestToken.js';
import { authRateLimiter } from '../../http/middleware/rateLimit.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import * as controller from './auth.controller.js';

export const authRouter = Router();

authRouter.post(
  '/register',
  authRateLimiter,
  guestTokenMiddleware,
  validate('body', registerSchema),
  asyncHandler(controller.registerHandler)
);
authRouter.post(
  '/login',
  authRateLimiter,
  guestTokenMiddleware,
  validate('body', loginSchema),
  asyncHandler(controller.loginHandler)
);
authRouter.post('/refresh', authRateLimiter, asyncHandler(controller.refreshHandler));
authRouter.post('/logout', asyncHandler(controller.logoutHandler));
authRouter.get('/me', requireAuth, asyncHandler(controller.meHandler));
authRouter.post(
  '/change-password',
  requireAuth,
  authRateLimiter,
  validate('body', changePasswordSchema),
  asyncHandler(controller.changePasswordHandler)
);
