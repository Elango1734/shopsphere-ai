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

/** Optional UTC day for the merchant daily report; defaults to yesterday server-side. */
export const dailyReportQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
    .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00.000Z`)), 'date must be a real calendar date')
    .optional()
});
