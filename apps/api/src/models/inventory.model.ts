import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * One inventory document per variant (1:1, unique index on variantId). Kept
 * out of ProductVariant so hot-path stock mutations (reserve/release/commit)
 * are tight conditional updates on a tiny document, isolated from catalog
 * edits. `available` is intentionally not stored — it is always derived as
 * `onHand - reserved` so it can never drift from the authoritative counters;
 * repositories expose it as a computed value, never write it directly.
 */
const inventorySchema = new Schema(
  {
    variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'Seller', required: true },
    onHand: { type: Number, required: true, min: 0, default: 0 },
    reserved: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, min: 0, default: 5 },
    // Optimistic-concurrency guard in addition to Mongoose's own `__v`; incremented on every mutating operation.
    version: { type: Number, required: true, default: 0 }
  },
  { timestamps: true }
);

inventorySchema.pre('validate', function (next) {
  if (this.reserved > this.onHand) {
    this.invalidate('reserved', 'reserved cannot exceed onHand');
  }
  next();
});

inventorySchema.index({ variantId: 1 }, { unique: true });
inventorySchema.index({ sellerId: 1, onHand: 1 });

export type InventoryDocument = HydratedDocument<InferSchemaType<typeof inventorySchema>>;
export const InventoryModel = model('Inventory', inventorySchema, 'inventory');
