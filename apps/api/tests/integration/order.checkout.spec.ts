import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { Types } from 'mongoose';
import { startMemoryReplicaSet, stopMemoryReplicaSet, clearAllCollections } from '../setup/memoryReplSet.js';
import { withTransaction } from '../../src/db/transaction.js';
import {
  createOrder,
  transitionPaymentStatus,
  transitionFulfillmentStatus,
  DuplicateCheckoutError,
  InvalidStatusTransitionError,
  type CreateOrderInput
} from '../../src/repositories/order.repository.js';

beforeAll(async () => {
  await startMemoryReplicaSet();
}, 120_000);
afterAll(async () => {
  await stopMemoryReplicaSet();
});
afterEach(async () => {
  await clearAllCollections();
});

function buildOrderInput(overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
  const money = { amountMinor: 1000, currency: 'USD' };
  return {
    customerId: new Types.ObjectId().toString(),
    checkoutIdempotencyKey: 'key-1',
    items: [
      {
        productId: new Types.ObjectId().toString(),
        variantId: new Types.ObjectId().toString(),
        sellerId: new Types.ObjectId().toString(),
        name: 'Test Item',
        sku: 'SKU-1',
        attributes: {},
        unitPrice: money,
        discount: { amountMinor: 0, currency: 'USD' },
        quantity: 1,
        taxAmount: { amountMinor: 80, currency: 'USD' },
        lineTotal: { amountMinor: 1080, currency: 'USD' }
      }
    ],
    itemSubtotal: money,
    discountTotal: { amountMinor: 0, currency: 'USD' },
    taxTotal: { amountMinor: 80, currency: 'USD' },
    shippingTotal: { amountMinor: 0, currency: 'USD' },
    grandTotal: { amountMinor: 1080, currency: 'USD' },
    shippingAddressSnapshot: { recipientName: 'A', addressLine1: 'x', locality: 'y', postalCode: '1', countryCode: 'US' },
    ...overrides
  };
}

describe('Checkout idempotency (high-risk case: testing.md)', () => {
  it('rejects a second order creation with the same (customerId, checkoutIdempotencyKey)', async () => {
    const input = buildOrderInput();

    await withTransaction((session) => createOrder(input, session));
    await expect(withTransaction((session) => createOrder(input, session))).rejects.toThrow(DuplicateCheckoutError);
  });

  it('allows the same idempotency key to be reused by a different customer', async () => {
    const input1 = buildOrderInput({ checkoutIdempotencyKey: 'shared-key' });
    const input2 = buildOrderInput({ checkoutIdempotencyKey: 'shared-key', customerId: new Types.ObjectId().toString() });

    await withTransaction((session) => createOrder(input1, session));
    await expect(withTransaction((session) => createOrder(input2, session))).resolves.toBeDefined();
  });

  it('concurrent duplicate checkout submissions result in exactly one order', async () => {
    const input = buildOrderInput({ checkoutIdempotencyKey: 'race-key' });

    const attempt = () =>
      withTransaction((session) => createOrder(input, session)).then(
        () => 'created' as const,
        (error) => (error instanceof DuplicateCheckoutError ? ('duplicate' as const) : Promise.reject(error))
      );

    const results = await Promise.all([attempt(), attempt(), attempt()]);
    expect(results.filter((r) => r === 'created').length).toBe(1);
    expect(results.filter((r) => r === 'duplicate').length).toBe(2);
  });
});

describe('Order status transition guards', () => {
  it('rejects an invalid payment transition (pending -> refunded)', async () => {
    const order = await withTransaction((session) => createOrder(buildOrderInput(), session));
    await expect(transitionPaymentStatus(order._id.toString(), 'refunded')).rejects.toThrow(InvalidStatusTransitionError);
  });

  it('allows a valid payment transition chain: pending -> paid -> refunded', async () => {
    const order = await withTransaction((session) => createOrder(buildOrderInput(), session));
    await transitionPaymentStatus(order._id.toString(), 'paid');
    const refunded = await transitionPaymentStatus(order._id.toString(), 'refunded');
    expect(refunded.paymentStatus).toBe('refunded');
    expect(refunded.statusHistory.filter((h) => h.track === 'payment')).toHaveLength(3);
  });

  it('rejects an invalid fulfillment transition (pending -> delivered)', async () => {
    const order = await withTransaction((session) => createOrder(buildOrderInput(), session));
    await expect(transitionFulfillmentStatus(order._id.toString(), 'delivered')).rejects.toThrow(
      InvalidStatusTransitionError
    );
  });
});
