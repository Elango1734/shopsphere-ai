import { z } from 'zod';
import { objectIdSchema, moneyInputSchema, listQuerySchema } from './common.js';

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(140),
  slug: z.string().trim().min(1).max(160),
  parentId: objectIdSchema.optional(),
  description: z.string().trim().max(1000).optional()
});

export const createBrandSchema = z.object({
  name: z.string().trim().min(1).max(140),
  slug: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional()
});

export const moderateProductSchema = z.object({
  status: z.enum(['published', 'rejected', 'archived']),
  note: z.string().trim().max(1000).optional()
});

export const changeSellerStatusSchema = z.object({
  status: z.enum(['active', 'suspended', 'rejected', 'closed']),
  note: z.string().trim().max(500).optional()
});

export const changeUserStatusSchema = z.object({
  status: z.enum(['active', 'suspended']),
  note: z.string().trim().max(500).optional()
});

export const createCouponSchema = z
  .object({
    code: z.string().trim().min(3).max(40),
    description: z.string().trim().max(500).optional(),
    discountType: z.enum(['percentage', 'fixed_amount']),
    percentageBasisPoints: z.number().int().min(1).max(10_000).optional(),
    discountValue: moneyInputSchema.optional(),
    maxDiscount: moneyInputSchema.optional(),
    minOrderAmount: moneyInputSchema.optional(),
    currency: z.string().length(3).transform((v) => v.toUpperCase()),
    eligibleCategoryIds: z.array(objectIdSchema).default([]),
    eligibleProductIds: z.array(objectIdSchema).default([]),
    startsAt: z.coerce.date(),
    expiresAt: z.coerce.date(),
    usageLimit: z.number().int().min(1).optional(),
    perUserLimit: z.number().int().min(1).default(1)
  })
  .refine((v) => v.startsAt < v.expiresAt, { message: 'expiresAt must be after startsAt', path: ['expiresAt'] });

export const reviewModerationSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  note: z.string().trim().max(500).optional()
});

export const reviewReturnRequestSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  approvedAmount: moneyInputSchema.optional(),
  note: z.string().trim().max(500).optional()
});

export const adminUserQuerySchema = listQuerySchema.extend({
  role: z.enum(['customer', 'seller', 'support_agent', 'administrator']).optional(),
  status: z.enum(['pending_verification', 'active', 'suspended', 'deleted']).optional()
});

export const adminSellerQuerySchema = listQuerySchema.extend({
  status: z.enum(['pending_review', 'active', 'suspended', 'rejected', 'closed']).optional()
});

export const adminOrderQuerySchema = listQuerySchema.extend({
  paymentStatus: z.enum(['pending', 'authorized', 'paid', 'failed', 'partially_refunded', 'refunded', 'cancelled']).optional(),
  fulfillmentStatus: z
    .enum(['pending', 'confirmed', 'processing', 'partially_shipped', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned'])
    .optional(),
  customerEmail: z.string().trim().toLowerCase().email().optional()
});

export const adminReturnQuerySchema = listQuerySchema.extend({
  status: z.enum(['requested', 'approved', 'rejected', 'in_transit', 'received', 'refunded', 'closed']).optional()
});

export const adminProductQuerySchema = listQuerySchema.extend({
  moderationStatus: z.enum(['draft', 'pending_review', 'published', 'rejected', 'archived']).optional(),
  categoryId: objectIdSchema.optional(),
  sellerId: objectIdSchema.optional()
});

export const adminAnalyticsQuerySchema = z.object({
  rangeDays: z.coerce.number().int().min(1).max(365).default(30)
});

export const processRefundSchema = z.object({
  paymentAttemptId: objectIdSchema,
  returnRequestId: objectIdSchema.optional(),
  requestedAmount: moneyInputSchema,
  reason: z.string().trim().max(500).optional()
});
