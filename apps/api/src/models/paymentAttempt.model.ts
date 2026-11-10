import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { moneySchema } from './shared/money.schema.js';

export const PAYMENT_ATTEMPT_STATUSES = ['pending', 'authorized', 'succeeded', 'failed', 'cancelled'] as const;
export type PaymentAttemptStatus = (typeof PAYMENT_ATTEMPT_STATUSES)[number];

/**
 * An order can have multiple payment attempts (retry after decline, etc.);
 * Order.paymentStatus is the aggregate the rest of the system reads, derived
 * from attempts by the payment service. Never store card numbers, CVVs, or
 * other raw payment-instrument data here — only the provider's own opaque
 * reference and a redacted display hint (e.g. card brand + last 4).
 */
const paymentAttemptSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    provider: { type: String, required: true, trim: true, maxlength: 60 },
    providerPaymentRef: { type: String, trim: true, maxlength: 200 },
    amount: { type: moneySchema, required: true },
    status: { type: String, enum: PAYMENT_ATTEMPT_STATUSES, required: true, default: 'pending' },
    paymentMethodDisplay: { type: String, trim: true, maxlength: 60 },
    failureReason: { type: String, trim: true, maxlength: 500 },
    idempotencyKey: { type: String, required: true, trim: true },
    confirmedAt: { type: Date }
  },
  { timestamps: true }
);

paymentAttemptSchema.index({ orderId: 1, createdAt: -1 });
paymentAttemptSchema.index({ provider: 1, idempotencyKey: 1 }, { unique: true });
paymentAttemptSchema.index({ provider: 1, providerPaymentRef: 1 }, { sparse: true });

export type PaymentAttemptDocument = HydratedDocument<InferSchemaType<typeof paymentAttemptSchema>>;
export const PaymentAttemptModel = model('PaymentAttempt', paymentAttemptSchema, 'payment_attempts');
