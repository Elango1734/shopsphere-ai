import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import type { ReturnStatus } from '@shopsphere/shared-types';
import { moneySchema } from './shared/money.schema.js';
import { createStatusHistorySchema } from './shared/statusHistory.schema.js';

export const RETURN_STATUSES: readonly ReturnStatus[] = [
  'requested',
  'approved',
  'rejected',
  'in_transit',
  'received',
  'refunded',
  'closed'
] as const;

const returnItemSchema = new Schema(
  {
    variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant', required: true },
    quantity: { type: Number, required: true, min: 1 },
    reason: { type: String, trim: true, maxlength: 300 }
  },
  { _id: false }
);

/**
 * A return targets a subset of one order's items, so items here are a
 * bounded subset snapshot (never more than the parent order's own item
 * count) rather than a reference back into order.items.
 */
const returnRequestSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: {
      type: [returnItemSchema],
      required: true,
      validate: { validator: (arr: unknown[]) => arr.length > 0, message: 'A return must include at least one item' }
    },
    status: { type: String, enum: RETURN_STATUSES, required: true, default: 'requested' },
    statusHistory: { type: [createStatusHistorySchema(RETURN_STATUSES)], default: [] },
    requestedAmount: { type: moneySchema, required: true },
    approvedAmount: { type: moneySchema },
    reason: { type: String, trim: true, maxlength: 500 },
    resolutionNote: { type: String, trim: true, maxlength: 500 }
  },
  { timestamps: true }
);

returnRequestSchema.index({ orderId: 1 });
returnRequestSchema.index({ customerId: 1, createdAt: -1 });
returnRequestSchema.index({ status: 1, createdAt: -1 });

export type ReturnRequestDocument = HydratedDocument<InferSchemaType<typeof returnRequestSchema>>;
export const ReturnRequestModel = model('ReturnRequest', returnRequestSchema, 'returns');
