import { type ClientSession, Types } from 'mongoose';
import { CouponModel, type CouponDocument } from '../models/coupon.model.js';
import { PromotionRedemptionModel } from '../models/promotionRedemption.model.js';
import type { Money } from '@shopsphere/shared-types';

export class CouponNotEligibleError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'CouponNotEligibleError';
  }
}

export async function findActiveCouponByCode(code: string, now: Date = new Date()): Promise<CouponDocument | null> {
  return CouponModel.findOne({
    code: code.trim().toUpperCase(),
    isActive: true,
    startsAt: { $lte: now },
    expiresAt: { $gte: now }
  });
}

export async function getUserRedemptionCount(couponId: string, userId: string): Promise<number> {
  return PromotionRedemptionModel.countDocuments({ couponId, userId });
}

/**
 * Atomically consumes one global usage slot and records the per-user
 * redemption inside the given transaction session. The `$inc` is guarded by
 * `usedCount: { $lt: usageLimit }` (when a limit exists) so concurrent
 * checkouts cannot both succeed past the global cap — this is the same
 * conditional-update pattern as inventory reservation, applied to coupon
 * usage. The per-user limit is enforced by the caller checking
 * `getUserRedemptionCount` against `coupon.perUserLimit` before calling this,
 * and backed by the unique (couponId, userId, orderId) index at the storage
 * layer preventing the same order from redeeming twice.
 */
export async function redeemCoupon(
  couponId: string,
  userId: string,
  orderId: string,
  discountApplied: Money,
  session: ClientSession
): Promise<void> {
  const coupon = await CouponModel.findById(couponId, null, { session });
  if (!coupon) {
    throw new CouponNotEligibleError('Coupon not found');
  }

  const filter: Record<string, unknown> = { _id: new Types.ObjectId(couponId) };
  if (coupon.usageLimit != null) {
    filter.usedCount = { $lt: coupon.usageLimit };
  }

  const updated = await CouponModel.findOneAndUpdate(filter, { $inc: { usedCount: 1 } }, { session, new: true });
  if (!updated) {
    throw new CouponNotEligibleError('Coupon usage limit reached');
  }

  await PromotionRedemptionModel.create(
    [
      {
        kind: 'coupon',
        couponId: new Types.ObjectId(couponId),
        userId: new Types.ObjectId(userId),
        orderId: new Types.ObjectId(orderId),
        discountApplied
      }
    ],
    { session }
  );
}
