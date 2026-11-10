import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { startMemoryReplicaSet, stopMemoryReplicaSet, clearAllCollections } from '../setup/memoryReplSet.js';
import { CouponModel } from '../../src/models/coupon.model.js';

beforeAll(async () => {
  await startMemoryReplicaSet();
}, 120_000);
afterAll(async () => {
  await stopMemoryReplicaSet();
});
afterEach(async () => {
  await clearAllCollections();
});

describe('Coupon schema validation', () => {
  it('enforces a unique code', async () => {
    const base = {
      code: 'DUP10',
      discountType: 'percentage' as const,
      percentageBasisPoints: 1000,
      currency: 'USD',
      startsAt: new Date('2025-01-01'),
      expiresAt: new Date('2025-12-31')
    };
    await CouponModel.create(base);
    await expect(CouponModel.create(base)).rejects.toMatchObject({ code: 11000 });
  });

  it('requires percentageBasisPoints when discountType is percentage', async () => {
    const coupon = new CouponModel({
      code: 'BADPCT',
      discountType: 'percentage',
      currency: 'USD',
      startsAt: new Date('2025-01-01'),
      expiresAt: new Date('2025-12-31')
    });
    await expect(coupon.validate()).rejects.toThrow(/percentageBasisPoints/);
  });

  it('requires discountValue when discountType is fixed_amount', async () => {
    const coupon = new CouponModel({
      code: 'BADFIXED',
      discountType: 'fixed_amount',
      currency: 'USD',
      startsAt: new Date('2025-01-01'),
      expiresAt: new Date('2025-12-31')
    });
    await expect(coupon.validate()).rejects.toThrow(/discountValue/);
  });

  it('rejects expiresAt before startsAt', async () => {
    const coupon = new CouponModel({
      code: 'BADDATES',
      discountType: 'fixed_amount',
      discountValue: { amountMinor: 500, currency: 'USD' },
      currency: 'USD',
      startsAt: new Date('2025-12-31'),
      expiresAt: new Date('2025-01-01')
    });
    await expect(coupon.validate()).rejects.toThrow(/expiresAt must be after startsAt/);
  });
});
