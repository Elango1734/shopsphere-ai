import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const SUPPORT_MESSAGE_VISIBILITIES = ['customer_visible', 'internal_note'] as const;
export type SupportMessageVisibility = (typeof SUPPORT_MESSAGE_VISIBILITIES)[number];

/**
 * `visibility` separates agent-to-agent internal notes from customer-visible
 * replies at the data layer, not just in UI — repositories/queries serving
 * customer-facing endpoints must filter visibility: 'customer_visible' so an
 * internal note can never leak through a bug in a client-side filter.
 */
const supportMessageSchema = new Schema(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: 'SupportTicket', required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    visibility: { type: String, enum: SUPPORT_MESSAGE_VISIBILITIES, required: true, default: 'customer_visible' },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    attachmentStorageKeys: { type: [String], default: [] }
  },
  { timestamps: true }
);

supportMessageSchema.index({ ticketId: 1, createdAt: 1 });

export type SupportMessageDocument = HydratedDocument<InferSchemaType<typeof supportMessageSchema>>;
export const SupportMessageModel = model('SupportMessage', supportMessageSchema, 'support_messages');
