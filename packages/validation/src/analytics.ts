import { z } from 'zod';
import { objectIdSchema } from './common.js';

export const ANALYTICS_EVENT_TYPES = [
  'session_start',
  'product_view',
  'search',
  'add_to_cart',
  'checkout_start',
  'order_placed'
] as const;

/**
 * One storefront event. `sellerId` is deliberately absent: the server derives
 * it from `productId` so a client cannot attribute traffic to a seller it has
 * nothing to do with. Search text is absent for the same reason it is absent
 * from the model — only a result count is kept.
 */
export const analyticsEventSchema = z.object({
  type: z.enum(ANALYTICS_EVENT_TYPES),
  sessionId: z.string().trim().min(8).max(64),
  productId: objectIdSchema.optional(),
  categoryId: objectIdSchema.optional(),
  resultCount: z.number().int().min(0).max(100_000).optional(),
  occurredAt: z.string().datetime().optional()
});

/** Batched so a client can buffer a visit's events and flush them in one request. */
export const recordEventsSchema = z.object({
  events: z.array(analyticsEventSchema).min(1).max(50)
});
