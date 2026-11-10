import { z } from 'zod';
import { objectIdSchema } from './common.js';

export const addCartItemSchema = z.object({
  variantId: objectIdSchema,
  quantity: z.number().int().min(1).max(999)
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(0).max(999)
});

export const variantIdParamSchema = z.object({
  variantId: objectIdSchema
});

export const toggleWishlistSchema = z.object({
  productId: objectIdSchema,
  variantId: objectIdSchema.optional()
});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
