import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { Types } from 'mongoose';
import { startMemoryReplicaSet, stopMemoryReplicaSet, clearAllCollections } from '../setup/memoryReplSet.js';
import { CouponModel } from '../../src/models/coupon.model.js';
import { PromotionRedemptionModel } from '../../src/models/promotionRedemption.model.js';
import { withTransaction } from '../../src/db/transaction.js';
import { redeemCoupon, CouponNotEligibleError } from '../../src/repositories/coupon.repository.js';

beforeAll(async () => {
  await startMemoryReplicaSet();
}, 120_000);
afterAll(async () => {
  await stopMemoryReplicaSet();
});
afterEach(async () => {
  await clearAllCollections();
});

async function seedCoupon(usageLimit: number) {
  return CouponModel.create({
    code: 'LIMITED',
    discountType: 'fixed_amount',
    discountValue: { amountMinor: 500, currency: 'USD' },
    currency: 'USD',
    startsAt: new Date(Date.now() - 1000),
    expiresAt: new Date(Date.now() + 100000),
    usageLimit,
    usedCount: 0
  });
}

describe('Coupon global usage limit enforced atomically under concurrency', () => {
  it('allows exactly usageLimit concurrent redemptions and rejects the rest', async () => {
    const coupon = await seedCoupon(3);
    const discount = { amountMinor: 500, currency: 'USD' };

    const attempt = () =>
      withTransaction((session) =>
        redeemCoupon(coupon._id.toString(), new Types.ObjectId().toString(), new Types.ObjectId().toString(), discount, session)
      ).then(
        () => 'ok' as const,
        (error) => (error instanceof CouponNotEligibleError ? ('rejected' as const) : Promise.reject(error))
      );

    const results = await Promise.all(Array.from({ length: 6 }, attempt));
    expect(results.filter((r) => r === 'ok').length).toBe(3);
    expect(results.filter((r) => r === 'rejected').length).toBe(3);

    const persisted = await CouponModel.findById(coupon._id);
    expect(persisted!.usedCount).toBe(3);

    const redemptionCount = await PromotionRedemptionModel.countDocuments({ couponId: coupon._id });
    expect(redemptionCount).toBe(3);
  });

  it('rejects a duplicate redemption of the same coupon for the same order (unique index backstop)', async () => {
    const coupon = await seedCoupon(10);
    const userId = new Types.ObjectId().toString();
    const orderId = new Types.ObjectId().toString();
    const discount = { amountMinor: 500, currency: 'USD' };

    await withTransaction((session) => redeemCoupon(coupon._id.toString(), userId, orderId, discount, session));
    await expect(
      withTransaction((session) => redeemCoupon(coupon._id.toString(), userId, orderId, discount, session))
    ).rejects.toThrow();
  });
});
