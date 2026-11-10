import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { moneySchema } from './shared/money.schema.js';

export const REDEMPTION_KINDS = ['coupon', 'promotion'] as const;
export type RedemptionKind = (typeof REDEMPTION_KINDS)[number];

/**
 * Records a single successful application of a coupon or promotion to an
 * order, so per-user limits can be enforced via a unique index rather than by
 * scanning orders. Global usage counters live on the Coupon/Promotion
 * document itself and are incremented atomically (`$inc` guarded by a
 * `usedCount < usageLimit` filter) in the same transaction that inserts this
 * redemption record — see repositories/coupon.repository.ts.
 */
const promotionRedemptionSchema = new Schema(
  {
    kind: { type: String, enum: REDEMPTION_KINDS, required: true },
    couponId: { type: Schema.Types.ObjectId, ref: 'Coupon' },
    promotionId: { type: Schema.Types.ObjectId, ref: 'Promotion' },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    discountApplied: { type: moneySchema, required: true }
  },
  { timestamps: true }
);

promotionRedemptionSchema.pre('validate', function (next) {
  if (this.kind === 'coupon' && !this.couponId) this.invalidate('couponId', 'Required when kind is coupon');
  if (this.kind === 'promotion' && !this.promotionId) this.invalidate('promotionId', 'Required when kind is promotion');
  next();
});

// One redemption per (coupon, user, order): also the basis for per-user usage counts via a count query.
promotionRedemptionSchema.index({ couponId: 1, userId: 1, orderId: 1 }, { unique: true, sparse: true });
promotionRedemptionSchema.index({ promotionId: 1, userId: 1, orderId: 1 }, { unique: true, sparse: true });
promotionRedemptionSchema.index({ couponId: 1, userId: 1 });
promotionRedemptionSchema.index({ promotionId: 1, userId: 1 });

export type PromotionRedemptionDocument = HydratedDocument<InferSchemaType<typeof promotionRedemptionSchema>>;
export const PromotionRedemptionModel = model(
  'PromotionRedemption',
  promotionRedemptionSchema,
  'promotion_redemptions'
);
