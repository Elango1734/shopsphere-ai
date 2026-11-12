import { z } from 'zod';
import { objectIdSchema, listQuerySchema } from './common.js';

export const productListQuerySchema = listQuerySchema.extend({
  categoryId: objectIdSchema.optional(),
  brandId: objectIdSchema.optional(),
  sellerId: objectIdSchema.optional(),
  minPriceMinor: z.coerce.number().int().min(0).optional(),
  maxPriceMinor: z.coerce.number().int().min(0).optional(),
  q: z.string().trim().max(200).optional(),
  inStockOnly: z.coerce.boolean().optional(),
  minRating: z.coerce.number().min(0).max(5).optional()
});

export const productSlugParamSchema = z.object({
  slug: z.string().trim().min(1).max(220)
});

export const createProductQuestionSchema = z.object({
  body: z.string().trim().min(1).max(1000)
});

export const answerProductQuestionSchema = z.object({
  body: z.string().trim().min(1).max(2000)
});

export const compareQuerySchema = z.object({
  ids: z
    .string()
    .transform((v) => v.split(',').map((id) => id.trim()))
    .pipe(z.array(objectIdSchema).min(2).max(5))
});

export type ProductListQueryInput = z.infer<typeof productListQuerySchema>;
