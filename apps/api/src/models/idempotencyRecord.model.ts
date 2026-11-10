import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const IDEMPOTENCY_RECORD_STATUSES = ['pending', 'completed'] as const;
export type IdempotencyRecordStatus = (typeof IDEMPOTENCY_RECORD_STATUSES)[number];

/**
 * Implements the API contract's `Idempotency-Key` rule: a (principal, scope,
 * key) tuple maps to at most one logical operation outcome. `requestHash`
 * detects a reused key with *different* input (-> 409 IDEMPOTENCY_CONFLICT at
 * the service layer); `responseSnapshot` lets a retry with the *same* input
 * replay the original result without re-executing side effects. This is a
 * disposable dedupe cache, not the system of record — the authoritative
 * result lives on the created Order/PaymentAttempt — so a bounded TTL here is
 * safe and does not itself drive business state.
 */
const idempotencyRecordSchema = new Schema(
  {
    principalId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    scope: { type: String, required: true, trim: true, maxlength: 60 },
    key: { type: String, required: true, trim: true, maxlength: 200 },
    requestHash: { type: String, required: true, trim: true },
    status: { type: String, enum: IDEMPOTENCY_RECORD_STATUSES, required: true, default: 'pending' },
    responseSnapshot: { type: Schema.Types.Mixed },
    resultResourceId: { type: Schema.Types.ObjectId },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 48 * 60 * 60 * 1000)
    }
  },
  { timestamps: true }
);

idempotencyRecordSchema.index({ principalId: 1, scope: 1, key: 1 }, { unique: true });
idempotencyRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type IdempotencyRecordDocument = HydratedDocument<InferSchemaType<typeof idempotencyRecordSchema>>;
export const IdempotencyRecordModel = model('IdempotencyRecord', idempotencyRecordSchema, 'idempotency_records');
