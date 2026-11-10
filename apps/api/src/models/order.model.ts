import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import type { PaymentStatus, FulfillmentStatus } from '@shopsphere/shared-types';
import { moneySchema } from './shared/money.schema.js';
import { addressFieldsSchema } from './shared/address.schema.js';

export const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'pending',
  'authorized',
  'paid',
  'failed',
  'partially_refunded',
  'refunded',
  'cancelled'
] as const;

export const FULFILLMENT_STATUSES: readonly FulfillmentStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'partially_shipped',
  'shipped',
  'delivered',
  'cancelled',
  'return_requested',
  'returned'
] as const;

/**
 * Purchase-time snapshot of one line item. This never changes after order
 * creation and is never recomputed from current catalog/variant data — see
 * database-design.md ("Do not calculate historical order totals from current
 * catalog prices"). attributes is a plain object snapshot of the selected
 * variant's attributes at purchase time (e.g. { size: "M", color: "Black" }).
 */
const orderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'Seller', required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    sku: { type: String, required: true, trim: true },
    attributes: { type: Map, of: String, default: () => new Map() },
    unitPrice: { type: moneySchema, required: true },
    discount: { type: moneySchema, required: true },
    taxAmount: { type: moneySchema, required: true },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: moneySchema, required: true }
  },
  { _id: false }
);

const appliedPromotionSchema = new Schema(
  {
    kind: { type: String, enum: ['coupon', 'promotion'], required: true },
    refId: { type: Schema.Types.ObjectId, required: true },
    code: { type: String, trim: true },
    discountApplied: { type: moneySchema, required: true }
  },
  { _id: false }
);

const orderStatusHistorySchema = new Schema(
  {
    track: { type: String, enum: ['payment', 'fulfillment'], required: true },
    status: { type: String, required: true },
    changedAt: { type: Date, required: true, default: () => new Date() },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, trim: true, maxlength: 500 }
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: { validator: (arr: unknown[]) => arr.length > 0, message: 'An order must have at least one item' }
    },
    // Denormalized for seller-scoped fulfillment queries without unwinding items on every list request.
    sellerIds: { type: [Schema.Types.ObjectId], ref: 'Seller', required: true },
    itemSubtotal: { type: moneySchema, required: true },
    discountTotal: { type: moneySchema, required: true },
    taxTotal: { type: moneySchema, required: true },
    shippingTotal: { type: moneySchema, required: true },
    grandTotal: { type: moneySchema, required: true },
    appliedPromotions: { type: [appliedPromotionSchema], default: [] },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, required: true, default: 'pending' },
    fulfillmentStatus: { type: String, enum: FULFILLMENT_STATUSES, required: true, default: 'pending' },
    statusHistory: { type: [orderStatusHistorySchema], default: [] },
    shippingAddressSnapshot: { type: addressFieldsSchema, required: true },
    billingAddressSnapshot: { type: addressFieldsSchema },
    // Scoped to (customerId, checkout operation) to make repeated checkout submissions idempotent at the DB level,
    // independent of (and as a backstop to) the dedicated IdempotencyRecord cache used for the HTTP-layer contract.
    checkoutIdempotencyKey: { type: String, required: true, trim: true },
    placedAt: { type: Date, required: true, default: () => new Date() },
    cancelledAt: { type: Date },
    cancelReason: { type: String, trim: true, maxlength: 500 }
  },
  { timestamps: true }
);

orderSchema.index({ customerId: 1, checkoutIdempotencyKey: 1 }, { unique: true });
// Customer order chronology (order history screens).
orderSchema.index({ customerId: 1, createdAt: -1 });
// Seller fulfillment chronology (seller order queue), multikey on sellerIds.
orderSchema.index({ sellerIds: 1, fulfillmentStatus: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1, createdAt: -1 });

export type OrderDocument = HydratedDocument<InferSchemaType<typeof orderSchema>>;
export const OrderModel = model('Order', orderSchema, 'orders');
