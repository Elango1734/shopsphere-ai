import { type ClientSession, Types } from 'mongoose';
import { InventoryModel } from '../models/inventory.model.js';
import { InventoryReservationModel, type InventoryReservationDocument } from '../models/inventoryReservation.model.js';
import { withSession } from '../utils/session.js';

export class InsufficientStockError extends Error {
  constructor(variantId: string) {
    super(`Insufficient available stock for variant ${variantId}`);
    this.name = 'InsufficientStockError';
  }
}

export class ReservationNotActiveError extends Error {
  constructor(reservationId: string) {
    super(`Reservation ${reservationId} is not active`);
    this.name = 'ReservationNotActiveError';
  }
}

/**
 * Atomically reserves `quantity` units of `variantId` by only succeeding the
 * update when `onHand - reserved >= quantity` holds at write time — a
 * conditional update, not a read-then-write, so concurrent checkouts cannot
 * both observe stale availability and oversell (the race the inventory
 * concurrency tests in tests/integration exercise). Must be called inside the
 * same transaction session as the reservation document insert and the order
 * creation, per database-design.md's checkout flow.
 */
export async function reserveStock(
  variantId: string,
  quantity: number,
  checkoutId: string,
  expiresAt: Date,
  session: ClientSession
): Promise<InventoryReservationDocument> {
  const updated = await InventoryModel.findOneAndUpdate(
    {
      variantId: new Types.ObjectId(variantId),
      $expr: { $gte: [{ $subtract: ['$onHand', '$reserved'] }, quantity] }
    },
    { $inc: { reserved: quantity, version: 1 } },
    { session, new: true }
  );

  if (!updated) {
    throw new InsufficientStockError(variantId);
  }

  const [reservation] = await InventoryReservationModel.create(
    [
      {
        variantId: new Types.ObjectId(variantId),
        checkoutId,
        quantity,
        status: 'active',
        expiresAt
      }
    ],
    { session }
  );

  return reservation as InventoryReservationDocument;
}

/**
 * Converts an active reservation into permanent stock reduction once an
 * order is confirmed: `onHand` and `reserved` both drop by the reserved
 * quantity (stock is now sold, not just held), and the reservation moves to
 * `committed`. Guarded on `status: 'active'` so a reservation can only be
 * committed once.
 */
export async function commitReservation(
  reservationId: string,
  orderId: string,
  session: ClientSession
): Promise<void> {
  const reservation = await InventoryReservationModel.findOneAndUpdate(
    { _id: reservationId, status: 'active' },
    { $set: { status: 'committed', orderId: new Types.ObjectId(orderId) } },
    { session, new: true }
  );
  if (!reservation) {
    throw new ReservationNotActiveError(reservationId);
  }

  await InventoryModel.updateOne(
    { variantId: reservation.variantId },
    { $inc: { onHand: -reservation.quantity, reserved: -reservation.quantity, version: 1 } },
    { session }
  );
}

/**
 * Releases a held reservation back to available stock. Idempotent: releasing
 * an already-released/expired/committed reservation is a documented no-op
 * rather than an error, since both the expiry worker and a user-triggered
 * cancellation path may race to release the same reservation.
 */
export async function releaseReservation(reservationId: string, session?: ClientSession): Promise<void> {
  const reservation = await InventoryReservationModel.findOneAndUpdate(
    { _id: reservationId, status: 'active' },
    {
      $set: { status: 'released', releasedAt: new Date(), cleanupAfter: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
    },
    { ...withSession(session), new: true }
  );
  if (!reservation) {
    return;
  }

  await InventoryModel.updateOne(
    { variantId: reservation.variantId },
    { $inc: { reserved: -reservation.quantity, version: 1 } },
    withSession(session)
  );
}

/**
 * Expiry worker entry point: finds active reservations past their hold
 * window and releases each exactly once via the same conditional-release
 * path as a manual cancellation, so the "release inventory exactly once"
 * invariant (testing.md) holds regardless of caller.
 */
export async function releaseExpiredReservations(now: Date = new Date(), limit = 100): Promise<number> {
  const expired = await InventoryReservationModel.find({ status: 'active', expiresAt: { $lte: now } })
    .limit(limit)
    .select('_id');

  let released = 0;
  for (const doc of expired) {
    await releaseReservation(doc._id.toString());
    released += 1;
  }
  return released;
}

export async function getAvailableQuantity(variantId: string): Promise<number> {
  const inventory = await InventoryModel.findOne({ variantId: new Types.ObjectId(variantId) });
  if (!inventory) return 0;
  return inventory.onHand - inventory.reserved;
}

/**
 * Reverses a previously-committed reservation's stock deduction (see
 * `commitReservation`) when a placed-but-not-yet-fulfilled order is
 * cancelled. Only `onHand` moves — `reserved` was already decremented at
 * commit time, so there is nothing held to release here, just inventory to
 * give back.
 */
export async function restockVariant(variantId: string, quantity: number, session?: ClientSession): Promise<void> {
  await InventoryModel.updateOne(
    { variantId: new Types.ObjectId(variantId) },
    { $inc: { onHand: quantity, version: 1 } },
    withSession(session)
  );
}

export async function upsertOnHand(
  variantId: string,
  sellerId: string,
  onHand: number,
  session?: ClientSession
): Promise<void> {
  await InventoryModel.updateOne(
    { variantId: new Types.ObjectId(variantId) },
    { $set: { onHand, sellerId: new Types.ObjectId(sellerId) }, $inc: { version: 1 } },
    { upsert: true, ...withSession(session) }
  );
}
