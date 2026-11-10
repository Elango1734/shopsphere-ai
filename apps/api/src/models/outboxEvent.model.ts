import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const OUTBOX_EVENT_STATUSES = ['pending', 'processing', 'published', 'failed'] as const;
export type OutboxEventStatus = (typeof OUTBOX_EVENT_STATUSES)[number];

/**
 * Durable record for side effects that must survive a process restart
 * (architecture.md), e.g. "send order-confirmation notification" or "notify
 * seller of a new order" created in the same transaction as the Order write.
 * A separate worker polls `status: 'pending'` and transitions documents as it
 * publishes them; `attempts`/`nextAttemptAt` support backoff retry.
 * Published events are only TTL-cleaned well after publication, controlled by
 * `cleanupAfter`, which is set by the worker, not at creation time.
 */
const outboxEventSchema = new Schema(
  {
    eventType: { type: String, required: true, trim: true, maxlength: 100 },
    payload: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: OUTBOX_EVENT_STATUSES, required: true, default: 'pending' },
    attempts: { type: Number, default: 0, min: 0 },
    lastError: { type: String, trim: true, maxlength: 500 },
    nextAttemptAt: { type: Date, required: true, default: () => new Date() },
    publishedAt: { type: Date },
    cleanupAfter: { type: Date }
  },
  { timestamps: true }
);

outboxEventSchema.index({ status: 1, nextAttemptAt: 1 });
outboxEventSchema.index({ cleanupAfter: 1 }, { expireAfterSeconds: 0 });

export type OutboxEventDocument = HydratedDocument<InferSchemaType<typeof outboxEventSchema>>;
export const OutboxEventModel = model('OutboxEvent', outboxEventSchema, 'outbox_events');
