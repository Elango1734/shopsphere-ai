import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { moneySchema } from './shared/money.schema.js';

export const DISCOUNT_TYPES = ['percentage', 'fixed_amount'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

/**
 * Coupons are code-redeemed, customer-entered discounts. Promotions
 * (promotion.model.ts) are automatically-applied campaign discounts with no
 * code. Both share the redemption-limit shape but are kept as distinct
 * collections because their eligibility/application triggers differ enough
 * in the pricing service to make a shared base class more confusing than
 * helpful; `promotionRedemption.model.ts` records redemptions for either via
 * a `kind` discriminator so usage-limit enforcement logic is shared.
 */
const couponSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    description: { type: String, trim: true, maxlength: 500 },
    discountType: { type: String, enum: DISCOUNT_TYPES, required: true },
    // For `percentage`, amountMinor is parts-per-10000 of the order (basis points) held in a plain Number field below
    // instead of Money, since a percentage is not a currency amount. For `fixed_amount`, discountValue carries Money.
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
    perUserLimit: { type: Number, min: 1, default: 1 },
    stackableWithPromotions: { type: Boolean, default: false }
  },
  { timestamps: true }
);

couponSchema.pre('validate', function (next) {
  if (this.discountType === 'percentage' && !this.percentageBasisPoints) {
    this.invalidate('percentageBasisPoints', 'Required when discountType is percentage');
  }
  if (this.discountType === 'fixed_amount' && !this.discountValue) {
    this.invalidate('discountValue', 'Required when discountType is fixed_amount');
  }
  if (this.startsAt && this.expiresAt && this.startsAt >= this.expiresAt) {
    this.invalidate('expiresAt', 'expiresAt must be after startsAt');
  }
  if (this.usageLimit != null && this.usedCount > this.usageLimit) {
    this.invalidate('usedCount', 'usedCount cannot exceed usageLimit');
  }
  next();
});

couponSchema.index({ code: 1 }, { unique: true });
couponSchema.index({ isActive: 1, startsAt: 1, expiresAt: 1 });

export type CouponDocument = HydratedDocument<InferSchemaType<typeof couponSchema>>;
export const CouponModel = model('Coupon', couponSchema, 'coupons');
