import { z } from 'zod';
import { objectIdSchema, listQuerySchema } from './common.js';

export const createSupportTicketSchema = z.object({
  category: z.enum(['order', 'payment', 'return', 'account', 'product', 'other']).default('other'),
  subject: z.string().trim().min(1).max(200),
  orderId: objectIdSchema.optional(),
  message: z.string().trim().min(1).max(5000)
});

export const createSupportMessageSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  visibility: z.enum(['customer_visible', 'internal_note']).default('customer_visible')
});

export const assignSupportTicketSchema = z.object({
  assignedAgentId: objectIdSchema
});

export const supportMessageInputSchema = z.object({
  body: z.string().trim().min(1).max(5000)
});

export const updateTicketStatusSchema = z.object({
  status: z.enum(['resolved', 'closed'])
});

export const ticketQuerySchema = listQuerySchema.extend({
  status: z.enum(['open', 'assigned', 'waiting_on_customer', 'resolved', 'closed']).optional()
});

export const returnRequestInputSchema = z.object({
  orderId: objectIdSchema,
  items: z.array(z.object({ variantId: objectIdSchema, quantity: z.number().int().min(1), reason: z.string().trim().max(300).optional() })).min(1),
  reason: z.string().trim().max(500).optional()
});
