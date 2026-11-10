import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import type { InventoryReservationStatus } from '@shopsphere/shared-types';

export const RESERVATION_STATUSES: readonly InventoryReservationStatus[] = [
  'active',
  'committed',
  'released',
  'expired'
] as const;

/**
 * A checkout-scoped hold on stock. `expiresAt` marks when an *active*
 * reservation becomes eligible for release by the expiry worker — release
 * itself is an atomic inventory operation performed by that worker/service,
 * never implied by a TTL delete (architecture.md: "TTL indexes may clean
 * stale reservation records but are not the inventory-release mechanism").
 * `cleanupAfter` is only set once a reservation reaches a terminal state
 * (`released`/`committed`/`expired`) and is what the TTL index below acts on.
 */
const inventoryReservationSchema = new Schema(
  {
    variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
    checkoutId: { type: String, required: true, trim: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    quantity: { type: Number, required: true, min: 1 },
    status: { type: String, enum: RESERVATION_STATUSES, required: true, default: 'active' },
    expiresAt: { type: Date, required: true },
    releasedAt: { type: Date },
    cleanupAfter: { type: Date }
  },
  { timestamps: true }
);

inventoryReservationSchema.index({ variantId: 1, status: 1 });
inventoryReservationSchema.index({ checkoutId: 1 });
// Expiry worker scan: find active reservations whose hold window has elapsed.
inventoryReservationSchema.index({ status: 1, expiresAt: 1 });
// Safe disposal of already-terminal records; never deletes an `active` reservation.
inventoryReservationSchema.index({ cleanupAfter: 1 }, { expireAfterSeconds: 0 });

export type InventoryReservationDocument = HydratedDocument<InferSchemaType<typeof inventoryReservationSchema>>;
export const InventoryReservationModel = model(
  'InventoryReservation',
  inventoryReservationSchema,
  'inventory_reservations'
);
