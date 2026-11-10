import { Router } from 'express';
import { updateProfileSchema, createAddressSchema, updateAddressSchema } from '@shopsphere/validation';
import { validate } from '../../http/middleware/validate.js';
import { requireAuth } from '../../http/middleware/auth.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import * as controller from './profile.controller.js';

// Mounted at /api/v1/me in app.ts — NOT the shared bare /api/v1 prefix. A router's blanket `.use(requireAuth)`
// below runs for every request Express forwards into it, which is every request whose path starts with the
// router's mount prefix; sharing a prefix with catalog/discovery routers would make this auth check run (and
// reject) requests meant for those sibling, unauthenticated routes before they ever got a chance to match.
export const profileRouter = Router();
profileRouter.use(requireAuth);

profileRouter.patch('/', validate('body', updateProfileSchema), asyncHandler(controller.updateMeHandler));

profileRouter.get('/addresses', asyncHandler(controller.listAddressesHandler));
profileRouter.post('/addresses', validate('body', createAddressSchema), asyncHandler(controller.createAddressHandler));
profileRouter.get('/addresses/:addressId', asyncHandler(controller.getAddressHandler));
profileRouter.patch('/addresses/:addressId', validate('body', updateAddressSchema), asyncHandler(controller.updateAddressHandler));
profileRouter.delete('/addresses/:addressId', asyncHandler(controller.deleteAddressHandler));
