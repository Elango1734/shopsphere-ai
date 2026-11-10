import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const WEBHOOK_EVENT_STATUSES = ['received', 'processed', 'ignored', 'failed'] as const;
export type WebhookEventStatus = (typeof WEBHOOK_EVENT_STATUSES)[number];

/**
 * Durable dedupe record for inbound provider webhooks, keyed by the
 * provider's own event ID so a replayed/duplicated delivery is a no-op after
 * the first successful processing. `rawPayload` stores only what is needed
 * for reconciliation/audit — the webhook handler must redact unrelated
 * provider fields before persisting, never store raw card data here.
 */
const webhookEventSchema = new Schema(
  {
    provider: { type: String, required: true, trim: true, maxlength: 60 },
    providerEventId: { type: String, required: true, trim: true, maxlength: 200 },
    eventType: { type: String, required: true, trim: true, maxlength: 100 },
    status: { type: String, enum: WEBHOOK_EVENT_STATUSES, required: true, default: 'received' },
    relatedOrderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    rawPayload: { type: Schema.Types.Mixed },
    processingError: { type: String, trim: true, maxlength: 500 },
    processedAt: { type: Date }
  },
  { timestamps: true }
);

// Core dedupe guarantee: the same provider event is only ever recorded once.
webhookEventSchema.index({ provider: 1, providerEventId: 1 }, { unique: true });
webhookEventSchema.index({ status: 1, createdAt: -1 });

export type WebhookEventDocument = HydratedDocument<InferSchemaType<typeof webhookEventSchema>>;
export const WebhookEventModel = model('WebhookEvent', webhookEventSchema, 'webhook_events');
