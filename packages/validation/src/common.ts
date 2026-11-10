import { z } from 'zod';

/** 24 hex-char MongoDB ObjectId string. Public API IDs are opaque, but this is the wire format they use today. */
export const objectIdSchema = z.string().regex(/^[0-9a-f]{24}$/, 'Invalid ID format');

export const moneyInputSchema = z.object({
  amountMinor: z.number().int().min(0),
  currency: z
    .string()
    .length(3)
    .transform((v) => v.toUpperCase())
});

const MAX_PAGE_SIZE = 100;

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
  sort: z.string().max(60).optional(),
  order: z.enum(['asc', 'desc']).default('desc')
});

export type ListQueryInput = z.infer<typeof listQuerySchema>;

/** Factory for a single-ObjectId route param, e.g. `objectIdParamSchema('productId')` for `/products/:productId`. */
export function objectIdParamSchema<TName extends string>(name: TName) {
  return z.object({ [name]: objectIdSchema }) as z.ZodObject<Record<TName, typeof objectIdSchema>>;
}
