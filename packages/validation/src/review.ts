import { z } from 'zod';
import { objectIdSchema } from './common.js';

export const createReviewSchema = z.object({
  orderId: objectIdSchema,
  orderItemVariantId: objectIdSchema,
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(140).optional(),
  body: z.string().trim().max(5000).optional()
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
