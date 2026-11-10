import { z } from 'zod';
import { objectIdSchema } from './common.js';

export const aiDiscoverySchema = z.object({
  conversationId: objectIdSchema.optional(),
  message: z.string().trim().min(1).max(2000)
});

export const aiCompareSchema = z.object({
  conversationId: objectIdSchema.optional(),
  productIds: z.array(objectIdSchema).min(2).max(5)
});

export const aiSupportSchema = z.object({
  conversationId: objectIdSchema.optional(),
  message: z.string().trim().min(1).max(2000),
  orderId: objectIdSchema.optional()
});
