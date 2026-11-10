import { z } from 'zod';
import { objectIdSchema, moneyInputSchema, listQuerySchema } from './common.js';

export const sellerOnboardingSchema = z.object({
  storeName: z.string().trim().min(1).max(140),
  description: z.string().trim().max(2000).optional(),
  supportEmail: z.string().trim().toLowerCase().email().max(254).optional()
});

export const createProductSchema = z.object({
  categoryId: objectIdSchema,
  brandId: objectIdSchema.optional(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10_000).optional(),
  attributes: z.array(z.object({ name: z.string().trim().max(80), value: z.string().trim().max(300) })).max(40).default([]),
  images: z
    .array(z.object({ storageKey: z.string().trim().min(1), altText: z.string().trim().max(200).optional(), sortOrder: z.number().int().optional() }))
    .max(12)
    .default([]),
  returnPolicyRef: z.string().trim().max(80).optional(),
  warrantyPolicyRef: z.string().trim().max(80).optional()
});

export const updateProductSchema = createProductSchema.partial();

export const createVariantSchema = z.object({
  sku: z.string().trim().min(1).max(64),
  attributes: z.record(z.string(), z.string()).default({}),
  regularPrice: moneyInputSchema,
  salePrice: moneyInputSchema.optional(),
  weightGrams: z.number().min(0).optional(),
  barcodeGtin: z.string().trim().max(32).optional(),
  imageStorageKey: z.string().trim().optional(),
  initialOnHand: z.number().int().min(0).default(0)
});

export const updateVariantSchema = createVariantSchema.omit({ initialOnHand: true }).partial();

export const updateInventorySchema = z.object({
  onHand: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0).optional()
});

export const submitForReviewSchema = z.object({}).strict();

export const updateFulfillmentSchema = z.object({
  status: z.enum(['confirmed', 'processing', 'partially_shipped', 'shipped', 'delivered', 'cancelled']),
  note: z.string().trim().max(500).optional()
});

export const sellerOrderQuerySchema = listQuerySchema.extend({
  fulfillmentStatus: z
    .enum(['pending', 'confirmed', 'processing', 'partially_shipped', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned'])
    .optional()
});

export const createShipmentSchema = z.object({
  carrier: z.string().trim().max(80).optional(),
  trackingNumber: z.string().trim().max(100).optional(),
  variantIds: z.array(objectIdSchema).min(1)
});
