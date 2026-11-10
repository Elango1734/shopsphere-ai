import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { Types } from 'mongoose';
import { startMemoryReplicaSet, stopMemoryReplicaSet, clearAllCollections } from '../setup/memoryReplSet.js';
import { InventoryModel } from '../../src/models/inventory.model.js';
import { InventoryReservationModel } from '../../src/models/inventoryReservation.model.js';
import {
  reserveStock,
  commitReservation,
  releaseReservation,
  releaseExpiredReservations,
  getAvailableQuantity,
  InsufficientStockError
} from '../../src/repositories/inventory.repository.js';
import { withTransaction } from '../../src/db/transaction.js';

beforeAll(async () => {
  await startMemoryReplicaSet();
}, 120_000);
afterAll(async () => {
  await stopMemoryReplicaSet();
});
afterEach(async () => {
  await clearAllCollections();
});

async function seedInventory(onHand: number) {
  const variantId = new Types.ObjectId();
  await InventoryModel.create({ variantId, sellerId: new Types.ObjectId(), onHand, reserved: 0 });
  return variantId;
}

describe('Inventory reservation concurrency (high-risk case: testing.md)', () => {
  it('never allows two concurrent reservations to oversell a variant with only 1 unit of stock', async () => {
    const variantId = await seedInventory(1);
    const expiresAt = new Date(Date.now() + 60_000);

    const attempt = (checkoutId: string) =>
      withTransaction((session) => reserveStock(variantId.toString(), 1, checkoutId, expiresAt, session)).then(
        () => 'ok' as const,
        (error) => (error instanceof InsufficientStockError ? ('insufficient' as const) : Promise.reject(error))
      );

    const results = await Promise.all([attempt('checkout-a'), attempt('checkout-b')]);

    const succeeded = results.filter((r) => r === 'ok').length;
    const rejected = results.filter((r) => r === 'insufficient').length;
    expect(succeeded).toBe(1);
    expect(rejected).toBe(1);

    const inventory = await InventoryModel.findOne({ variantId });
    expect(inventory!.reserved).toBe(1);
    expect(await getAvailableQuantity(variantId.toString())).toBe(0);
  });

  it('allows exactly N concurrent reservations when N units are available, and rejects the (N+1)th', async () => {
    const variantId = await seedInventory(5);
    const expiresAt = new Date(Date.now() + 60_000);

    const attempt = (checkoutId: string) =>
      withTransaction((session) => reserveStock(variantId.toString(), 1, checkoutId, expiresAt, session)).then(
        () => 'ok' as const,
        (error) => (error instanceof InsufficientStockError ? ('insufficient' as const) : Promise.reject(error))
      );

    const results = await Promise.all(Array.from({ length: 7 }, (_, i) => attempt(`checkout-${i}`)));
    expect(results.filter((r) => r === 'ok').length).toBe(5);
    expect(results.filter((r) => r === 'insufficient').length).toBe(2);
  });

  it('commitReservation reduces onHand and reserved together, leaving availability unchanged', async () => {
    const variantId = await seedInventory(10);
    const reservation = await withTransaction((session) =>
      reserveStock(variantId.toString(), 3, 'checkout-commit', new Date(Date.now() + 60_000), session)
    );
    const orderId = new Types.ObjectId().toString();

    await withTransaction((session) => commitReservation(reservation._id.toString(), orderId, session));

    const inventory = await InventoryModel.findOne({ variantId });
    expect(inventory!.onHand).toBe(7);
    expect(inventory!.reserved).toBe(0);
    const committed = await InventoryReservationModel.findById(reservation._id);
    expect(committed!.status).toBe('committed');
  });

  it('releaseReservation returns reserved stock to available, and is idempotent on retry', async () => {
    const variantId = await seedInventory(4);
    const reservation = await withTransaction((session) =>
      reserveStock(variantId.toString(), 2, 'checkout-release', new Date(Date.now() + 60_000), session)
    );
    expect(await getAvailableQuantity(variantId.toString())).toBe(2);

    await releaseReservation(reservation._id.toString());
    expect(await getAvailableQuantity(variantId.toString())).toBe(4);

    // Second release of the same (now terminal) reservation must be a safe no-op, not a double-release.
    await releaseReservation(reservation._id.toString());
    expect(await getAvailableQuantity(variantId.toString())).toBe(4);
  });

  it('releaseExpiredReservations releases each expired active reservation exactly once', async () => {
    const variantId = await seedInventory(3);
    await withTransaction((session) =>
      reserveStock(variantId.toString(), 2, 'checkout-expired', new Date(Date.now() - 1000), session)
    );

    const releasedFirstPass = await releaseExpiredReservations(new Date());
    expect(releasedFirstPass).toBe(1);
    expect(await getAvailableQuantity(variantId.toString())).toBe(3);

    const releasedSecondPass = await releaseExpiredReservations(new Date());
    expect(releasedSecondPass).toBe(0);
  });
});
