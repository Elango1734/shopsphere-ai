import { Router } from 'express';
import {
  createSupportTicketSchema,
  supportMessageInputSchema,
  createSupportMessageSchema,
  assignSupportTicketSchema,
  updateTicketStatusSchema,
  ticketQuerySchema,
  listQuerySchema,
  objectIdParamSchema
} from '@shopsphere/validation';
import { validate } from '../../http/middleware/validate.js';
import { requireAuth, requireRole } from '../../http/middleware/auth.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import * as controller from './support.controller.js';

export const supportRouter = Router();
supportRouter.use(requireAuth);

// Customer-facing.
supportRouter.post('/tickets', validate('body', createSupportTicketSchema), asyncHandler(controller.createTicketHandler));
supportRouter.get('/tickets', validate('query', listQuerySchema), asyncHandler(controller.listMyTicketsHandler));
supportRouter.get('/tickets/:ticketId', validate('params', objectIdParamSchema('ticketId')), asyncHandler(controller.getMyTicketHandler));
supportRouter.get(
  '/tickets/:ticketId/messages',
  validate('params', objectIdParamSchema('ticketId')),
  asyncHandler(controller.listMyMessagesHandler)
);
supportRouter.post(
  '/tickets/:ticketId/messages',
  validate('params', objectIdParamSchema('ticketId')),
  validate('body', supportMessageInputSchema),
  asyncHandler(controller.addCustomerMessageHandler)
);

// Agent/admin-facing.
export const supportAgentRouter = Router();
supportAgentRouter.use(requireAuth, requireRole('support_agent', 'administrator'));

supportAgentRouter.get('/assigned', validate('query', ticketQuerySchema), asyncHandler(controller.listAssignedTicketsHandler));
supportAgentRouter.get('/unassigned', validate('query', listQuerySchema), asyncHandler(controller.listUnassignedTicketsHandler));
supportAgentRouter.post(
  '/tickets/:ticketId/assign',
  validate('params', objectIdParamSchema('ticketId')),
  validate('body', assignSupportTicketSchema),
  asyncHandler(controller.assignTicketHandler)
);
supportAgentRouter.get(
  '/tickets/:ticketId/messages',
  validate('params', objectIdParamSchema('ticketId')),
  asyncHandler(controller.listAgentMessagesHandler)
);
supportAgentRouter.post(
  '/tickets/:ticketId/messages',
  validate('params', objectIdParamSchema('ticketId')),
  validate('body', createSupportMessageSchema),
  asyncHandler(controller.addAgentMessageHandler)
);
supportAgentRouter.patch(
  '/tickets/:ticketId/status',
  validate('params', objectIdParamSchema('ticketId')),
  validate('body', updateTicketStatusSchema),
  asyncHandler(controller.updateTicketStatusHandler)
);
