import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const SUPPORT_TICKET_STATUSES = ['open', 'assigned', 'waiting_on_customer', 'resolved', 'closed'] as const;
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];

export const SUPPORT_TICKET_CATEGORIES = ['order', 'payment', 'return', 'account', 'product', 'other'] as const;

/**
 * Ticket metadata only; messages live in support_message (separate
 * collection) because a ticket's conversation is open-ended and can grow
 * large over its lifetime — unlike ProductQuestion answers, which are
 * naturally few and embedded.
 */
const supportTicketSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    category: { type: String, enum: SUPPORT_TICKET_CATEGORIES, required: true, default: 'other' },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    status: { type: String, enum: SUPPORT_TICKET_STATUSES, required: true, default: 'open' },
    assignedAgentId: { type: Schema.Types.ObjectId, ref: 'User' },
    escalatedAt: { type: Date },
    resolvedAt: { type: Date },
    lastMessageAt: { type: Date }
  },
  { timestamps: true }
);

supportTicketSchema.index({ customerId: 1, createdAt: -1 });
supportTicketSchema.index({ assignedAgentId: 1, status: 1, lastMessageAt: -1 });
supportTicketSchema.index({ status: 1, createdAt: -1 });

export type SupportTicketDocument = HydratedDocument<InferSchemaType<typeof supportTicketSchema>>;
export const SupportTicketModel = model('SupportTicket', supportTicketSchema, 'support_tickets');
