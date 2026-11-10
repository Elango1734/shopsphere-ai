import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const AI_CONVERSATION_PURPOSES = ['discovery', 'compare', 'support'] as const;
export type AiConversationPurpose = (typeof AI_CONVERSATION_PURPOSES)[number];

/**
 * Conversation metadata only; individual turns live in AIMessage (own
 * collection — a conversation's message count is unbounded over time).
 * `retainUntil` implements user-controlled retention: deleting history early
 * sets it to `now`, which both the AIMessage TTL index and an explicit
 * deletion repository method respect. Conversation content is never treated
 * as an authorization signal by any service — see security.md's AI boundary.
 */
const aiConversationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    guestTokenHash: { type: String, trim: true },
    purpose: { type: String, enum: AI_CONVERSATION_PURPOSES, required: true },
    title: { type: String, trim: true, maxlength: 140 },
    lastMessageAt: { type: Date },
    retainUntil: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    },
    deletedAt: { type: Date }
  },
  { timestamps: true }
);

aiConversationSchema.pre('validate', function (next) {
  if (!this.userId && !this.guestTokenHash) {
    this.invalidate('userId', 'Must have exactly one of userId or guestTokenHash');
  }
  next();
});

aiConversationSchema.index({ userId: 1, createdAt: -1 });
aiConversationSchema.index({ guestTokenHash: 1, createdAt: -1 });
aiConversationSchema.index({ retainUntil: 1 }, { expireAfterSeconds: 0 });

export type AiConversationDocument = HydratedDocument<InferSchemaType<typeof aiConversationSchema>>;
export const AiConversationModel = model('AIConversation', aiConversationSchema, 'ai_conversations');
