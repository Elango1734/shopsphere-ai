import type { SupportTicketDocument } from '../../models/supportTicket.model.js';
import type { SupportMessageDocument } from '../../models/supportMessage.model.js';
import { toPublicId } from '../../utils/ids.js';

export function toTicketDto(ticket: SupportTicketDocument) {
  return {
    id: toPublicId(ticket._id),
    customerId: toPublicId(ticket.customerId),
    orderId: ticket.orderId ? toPublicId(ticket.orderId) : null,
    category: ticket.category,
    subject: ticket.subject,
    status: ticket.status,
    assignedAgentId: ticket.assignedAgentId ? toPublicId(ticket.assignedAgentId) : null,
    lastMessageAt: ticket.lastMessageAt?.toISOString() ?? null,
    createdAt: ticket.createdAt.toISOString()
  };
}

export function toMessageDto(message: SupportMessageDocument) {
  return {
    id: toPublicId(message._id),
    ticketId: toPublicId(message.ticketId),
    authorId: toPublicId(message.authorId),
    visibility: message.visibility,
    body: message.body,
    createdAt: message.createdAt.toISOString()
  };
}
