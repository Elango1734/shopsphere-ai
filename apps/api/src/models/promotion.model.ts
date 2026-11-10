import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { moneySchema } from './shared/money.schema.js';
import { DISCOUNT_TYPES, type DiscountType } from './coupon.model.js';

/**
 * Automatically-applied campaign discount, no customer-entered code. See
 * coupon.model.ts for why this is a separate collection rather than a shared
 * base schema.
 */
const promotionSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, trim: true, maxlength: 500 },
    discountType: { type: String, enum: DISCOUNT_TYPES, required: true },
    percentageBasisPoints: { type: Number, min: 1, max: 10_000 },
    discountValue: { type: moneySchema },
    maxDiscount: { type: moneySchema },
    minOrderAmount: { type: moneySchema },
    currency: { type: String, required: true, uppercase: true, match: /^[A-Z]{3}$/ },
    eligibleCategoryIds: { type: [Schema.Types.ObjectId], ref: 'Category', default: [] },
    eligibleProductIds: { type: [Schema.Types.ObjectId], ref: 'Product', default: [] },
    startsAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    usageLimit: { type: Number, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    perUserLimit: { type: Number, min: 1 },
    priority: { type: Number, default: 0 }
  },
  { timestamps: true }
);

promotionSchema.pre('validate', function (next) {
  if (this.discountType === ('percentage' as DiscountType) && !this.percentageBasisPoints) {
    this.invalidate('percentageBasisPoints', 'Required when discountType is percentage');
  }
  if (this.discountType === ('fixed_amount' as DiscountType) && !this.discountValue) {
    this.invalidate('discountValue', 'Required when discountType is fixed_amount');
  }
  if (this.startsAt && this.expiresAt && this.startsAt >= this.expiresAt) {
    this.invalidate('expiresAt', 'expiresAt must be after startsAt');
  }
  next();
});

promotionSchema.index({ isActive: 1, startsAt: 1, expiresAt: 1, priority: -1 });
promotionSchema.index({ eligibleCategoryIds: 1 });

export type PromotionDocument = HydratedDocument<InferSchemaType<typeof promotionSchema>>;
export const PromotionModel = model('Promotion', promotionSchema, 'promotions');
