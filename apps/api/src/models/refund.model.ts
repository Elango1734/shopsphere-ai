import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import type { RefundStatus } from '@shopsphere/shared-types';
import { moneySchema } from './shared/money.schema.js';
import { createStatusHistorySchema } from './shared/statusHistory.schema.js';

export const REFUND_STATUSES: readonly RefundStatus[] = [
  'pending',
  'processing',
  'succeeded',
  'failed',
  'cancelled'
] as const;

/**
 * A return request and a refund are distinct records (entity-status-glossary):
 * a return can close without a refund (e.g. rejected), and in principle a
 * refund can be issued without a full return flow (goodwill credit). Both
 * link back to the order and, optionally, a return. The hard invariant —
 * cumulative succeeded refunds for an order never exceed its captured payment
 * amount — is enforced in the refund service (reading all prior succeeded
 * refunds for the order inside the same transaction before inserting a new
 * one), not solely by a schema validator, since that requires a cross-document
 * aggregate the schema layer cannot see. See repositories/refund.repository.ts.
 */
const refundSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    returnRequestId: { type: Schema.Types.ObjectId, ref: 'ReturnRequest' },
    paymentAttemptId: { type: Schema.Types.ObjectId, ref: 'PaymentAttempt', required: true },
    requestedAmount: { type: moneySchema, required: true },
    approvedAmount: { type: moneySchema },
    reason: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: REFUND_STATUSES, required: true, default: 'pending' },
    statusHistory: { type: [createStatusHistorySchema(REFUND_STATUSES)], default: [] },
    providerRefundRef: { type: String, trim: true, maxlength: 200 },
    failureReason: { type: String, trim: true, maxlength: 500 }
  },
  { timestamps: true }
);

refundSchema.index({ orderId: 1, createdAt: -1 });
refundSchema.index({ status: 1, createdAt: -1 });
refundSchema.index({ providerRefundRef: 1 }, { sparse: true });

export type RefundDocument = HydratedDocument<InferSchemaType<typeof refundSchema>>;
export const RefundModel = model('Refund', refundSchema, 'refunds');
