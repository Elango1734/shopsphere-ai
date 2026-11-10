import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { Types } from 'mongoose';
import { startMemoryReplicaSet, stopMemoryReplicaSet, clearAllCollections } from '../setup/memoryReplSet.js';
import { ReviewModel } from '../../src/models/review.model.js';

beforeAll(async () => {
  await startMemoryReplicaSet();
}, 120_000);
afterAll(async () => {
  await stopMemoryReplicaSet();
});
afterEach(async () => {
  await clearAllCollections();
});

describe('Review duplicate-review guard', () => {
  it('rejects a second review for the same (orderId, orderItemVariantId)', async () => {
    const orderId = new Types.ObjectId();
    const orderItemVariantId = new Types.ObjectId();
    const base = {
      productId: new Types.ObjectId(),
      customerId: new Types.ObjectId(),
      orderId,
      orderItemVariantId,
      rating: 5
    };

    await ReviewModel.create(base);
    await expect(ReviewModel.create(base)).rejects.toMatchObject({ code: 11000 });
  });

  it('allows two reviews for two different variants purchased in the same order', async () => {
    const orderId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const productId = new Types.ObjectId();

    await ReviewModel.create({ productId, customerId, orderId, orderItemVariantId: new Types.ObjectId(), rating: 4 });
    await expect(
      ReviewModel.create({ productId, customerId, orderId, orderItemVariantId: new Types.ObjectId(), rating: 5 })
    ).resolves.toBeDefined();
  });

  it('rejects a rating outside 1..5', async () => {
    const review = new ReviewModel({
      productId: new Types.ObjectId(),
      customerId: new Types.ObjectId(),
      orderId: new Types.ObjectId(),
      orderItemVariantId: new Types.ObjectId(),
      rating: 6
    });
    await expect(review.validate()).rejects.toThrow();
  });
});
