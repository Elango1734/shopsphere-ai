import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const AI_MESSAGE_ROLES = ['user', 'assistant', 'system', 'tool'] as const;
export type AiMessageRole = (typeof AI_MESSAGE_ROLES)[number];

/**
 * `expireAt` is copied from the parent AIConversation's `retainUntil` at
 * write time (and updated by the retention-change repository method) rather
 * than being a fixed global TTL, because retention is a per-conversation,
 * user-controlled policy. `groundedProductIds`/`toolCalls` record what catalog
 * data an assistant turn actually cited, so support/audit can verify a
 * response was grounded rather than model-invented — see security.md's AI
 * boundary and product-requirements.md. Never store payment credentials or
 * unnecessary personal data in `content`.
 */
const toolCallSchema = new Schema(
  {
    toolName: { type: String, required: true, trim: true, maxlength: 80 },
    requestSummary: { type: Schema.Types.Mixed },
    resultSummary: { type: Schema.Types.Mixed }
  },
  { _id: false }
);

const aiMessageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'AIConversation', required: true },
    role: { type: String, enum: AI_MESSAGE_ROLES, required: true },
    content: { type: String, required: true, trim: true, maxlength: 8000 },
    groundedProductIds: { type: [Schema.Types.ObjectId], ref: 'Product', default: [] },
    toolCalls: { type: [toolCallSchema], default: [] },
    expireAt: { type: Date, required: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

aiMessageSchema.index({ conversationId: 1, createdAt: 1 });
aiMessageSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export type AiMessageDocument = HydratedDocument<InferSchemaType<typeof aiMessageSchema>>;
export const AiMessageModel = model('AIMessage', aiMessageSchema, 'ai_messages');
