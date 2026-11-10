import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { Types } from 'mongoose';
import { startMemoryReplicaSet, stopMemoryReplicaSet, clearAllCollections } from '../setup/memoryReplSet.js';
import {
  getOrCreateGuestCart,
  getOrCreateUserCart,
  addItem,
  mergeGuestCartIntoUserCart
} from '../../src/repositories/cart.repository.js';

beforeAll(async () => {
  await startMemoryReplicaSet();
}, 120_000);
afterAll(async () => {
  await stopMemoryReplicaSet();
});
afterEach(async () => {
  await clearAllCollections();
});

describe('Guest-to-user cart merge', () => {
  it('sums quantities when both carts contain the same variant', async () => {
    const variantId = new Types.ObjectId().toString();
    const productId = new Types.ObjectId().toString();
    const sellerId = new Types.ObjectId().toString();
    const price = { amountMinor: 1000, currency: 'USD' };

    const guestCart = await getOrCreateGuestCart('raw-guest-token-1');
    await addItem(guestCart._id.toString(), { variantId, productId, sellerId, quantity: 2, indicativeUnitPrice: price });

    const userId = new Types.ObjectId().toString();
    const userCart = await getOrCreateUserCart(userId);
    await addItem(userCart._id.toString(), { variantId, productId, sellerId, quantity: 3, indicativeUnitPrice: price });

    const merged = await mergeGuestCartIntoUserCart(guestCart._id.toString(), userId);

    expect(merged.items).toHaveLength(1);
    expect(merged.items[0]!.quantity).toBe(5);
  });

  it('appends a variant the user cart does not already have', async () => {
    const sharedProductId = new Types.ObjectId().toString();
    const sellerId = new Types.ObjectId().toString();
    const price = { amountMinor: 500, currency: 'USD' };

    const guestVariantId = new Types.ObjectId().toString();
    const userVariantId = new Types.ObjectId().toString();

    const guestCart = await getOrCreateGuestCart('raw-guest-token-2');
    await addItem(guestCart._id.toString(), {
      variantId: guestVariantId,
      productId: sharedProductId,
      sellerId,
      quantity: 1,
      indicativeUnitPrice: price
    });

    const userId = new Types.ObjectId().toString();
    const userCart = await getOrCreateUserCart(userId);
    await addItem(userCart._id.toString(), {
      variantId: userVariantId,
      productId: sharedProductId,
      sellerId,
      quantity: 1,
      indicativeUnitPrice: price
    });

    const merged = await mergeGuestCartIntoUserCart(guestCart._id.toString(), userId);
    expect(merged.items).toHaveLength(2);
  });

  it('marks the guest cart as merged and empties it, so a second merge is a no-op', async () => {
    const variantId = new Types.ObjectId().toString();
    const productId = new Types.ObjectId().toString();
    const sellerId = new Types.ObjectId().toString();
    const price = { amountMinor: 750, currency: 'USD' };

    const guestCart = await getOrCreateGuestCart('raw-guest-token-3');
    await addItem(guestCart._id.toString(), { variantId, productId, sellerId, quantity: 1, indicativeUnitPrice: price });

    const userId = new Types.ObjectId().toString();
    await mergeGuestCartIntoUserCart(guestCart._id.toString(), userId);
    const secondMerge = await mergeGuestCartIntoUserCart(guestCart._id.toString(), userId);

    // Idempotent: re-merging an already-merged guest cart must not double the quantity.
    expect(secondMerge.items[0]!.quantity).toBe(1);
  });

  it('caps a single line quantity at the configured maximum when adding repeatedly', async () => {
    const variantId = new Types.ObjectId().toString();
    const productId = new Types.ObjectId().toString();
    const sellerId = new Types.ObjectId().toString();
    const price = { amountMinor: 999, currency: 'USD' };

    const userId = new Types.ObjectId().toString();
    const cart = await getOrCreateUserCart(userId);
    await addItem(cart._id.toString(), { variantId, productId, sellerId, quantity: 500, indicativeUnitPrice: price });
    const updated = await addItem(cart._id.toString(), {
      variantId,
      productId,
      sellerId,
      quantity: 600,
      indicativeUnitPrice: price
    });

    expect(updated!.items[0]!.quantity).toBe(999);
  });
});
