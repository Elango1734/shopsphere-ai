import { Types } from 'mongoose';
import { SupportTicketModel, type SupportTicketDocument } from '../../models/supportTicket.model.js';
import { SupportMessageModel } from '../../models/supportMessage.model.js';
import { NotFoundError, ForbiddenError } from '../../http/errors.js';

export interface CreateTicketInput {
  category: 'order' | 'payment' | 'return' | 'account' | 'product' | 'other';
  subject: string;
  orderId?: string;
  message: string;
}

export async function createTicket(customerId: string, input: CreateTicketInput): Promise<SupportTicketDocument> {
  const ticket = await SupportTicketModel.create({
    customerId,
    category: input.category,
    subject: input.subject,
    orderId: input.orderId,
    status: 'open',
    lastMessageAt: new Date()
  });
  await SupportMessageModel.create({ ticketId: ticket._id, authorId: customerId, body: input.message, visibility: 'customer_visible' });
  return ticket;
}

export async function listMyTickets(customerId: string, page: number, pageSize: number) {
  const skip = (page - 1) * pageSize;
  const filter = { customerId };
  const [tickets, totalItems] = await Promise.all([
    SupportTicketModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
    SupportTicketModel.countDocuments(filter)
  ]);
  return { tickets, totalItems };
}

export async function getOwnedTicket(customerId: string, ticketId: string): Promise<SupportTicketDocument> {
  const ticket = await SupportTicketModel.findOne({ _id: ticketId, customerId });
  if (!ticket) throw new NotFoundError('Support ticket not found');
  return ticket;
}

export async function listMessagesForOwnedTicket(customerId: string, ticketId: string) {
  await getOwnedTicket(customerId, ticketId);
  return SupportMessageModel.find({ ticketId, visibility: 'customer_visible' }).sort({ createdAt: 1 });
}

export async function addCustomerMessage(customerId: string, ticketId: string, body: string) {
  const ticket = await getOwnedTicket(customerId, ticketId);
  const message = await SupportMessageModel.create({ ticketId: ticket._id, authorId: customerId, body, visibility: 'customer_visible' });
  ticket.lastMessageAt = new Date();
  if (ticket.status === 'resolved' || ticket.status === 'closed') ticket.status = 'waiting_on_customer';
  await ticket.save();
  return message;
}

/**
 * Support access is assignment-scoped (security.md): an agent may act on a
 * ticket only once assigned to them, or pick up an unassigned one by acting
 * on it (which implicitly requires an explicit assign call first in this
 * implementation — see assignTicket). Administrators bypass this scoping
 * for oversight, consistent with their broader governance role.
 */
async function getTicketForAgent(agentUserId: string, agentRoles: string[], ticketId: string): Promise<SupportTicketDocument> {
  const ticket = await SupportTicketModel.findById(ticketId);
  if (!ticket) throw new NotFoundError('Support ticket not found');
  if (agentRoles.includes('administrator')) return ticket;
  if (ticket.assignedAgentId?.toString() !== agentUserId) {
    throw new ForbiddenError('This ticket is not assigned to you');
  }
  return ticket;
}

export async function listAssignedTickets(agentUserId: string, page: number, pageSize: number, status?: string) {
  const filter: Record<string, unknown> = { assignedAgentId: agentUserId };
  if (status) filter.status = status;
  const skip = (page - 1) * pageSize;
  const [tickets, totalItems] = await Promise.all([
    SupportTicketModel.find(filter).sort({ lastMessageAt: -1 }).skip(skip).limit(pageSize),
    SupportTicketModel.countDocuments(filter)
  ]);
  return { tickets, totalItems };
}

export async function listUnassignedTickets(page: number, pageSize: number) {
  const filter = { assignedAgentId: { $exists: false }, status: 'open' };
  const skip = (page - 1) * pageSize;
  const [tickets, totalItems] = await Promise.all([
    SupportTicketModel.find(filter).sort({ createdAt: 1 }).skip(skip).limit(pageSize),
    SupportTicketModel.countDocuments(filter)
  ]);
  return { tickets, totalItems };
}

export async function assignTicket(agentUserId: string, agentRoles: string[], ticketId: string, assigneeId: string) {
  const ticket = await SupportTicketModel.findById(ticketId);
  if (!ticket) throw new NotFoundError('Support ticket not found');
  if (!agentRoles.includes('administrator') && ticket.assignedAgentId && ticket.assignedAgentId.toString() !== agentUserId) {
    throw new ForbiddenError('This ticket is already assigned to another agent');
  }
  ticket.assignedAgentId = new Types.ObjectId(assigneeId);
  ticket.status = 'assigned';
  await ticket.save();
  return ticket;
}

export async function listAllMessagesForAgent(agentUserId: string, agentRoles: string[], ticketId: string) {
  await getTicketForAgent(agentUserId, agentRoles, ticketId);
  return SupportMessageModel.find({ ticketId }).sort({ createdAt: 1 });
}

export async function addAgentMessage(
  agentUserId: string,
  agentRoles: string[],
  ticketId: string,
  body: string,
  visibility: 'customer_visible' | 'internal_note'
) {
  const ticket = await getTicketForAgent(agentUserId, agentRoles, ticketId);
  const message = await SupportMessageModel.create({ ticketId: ticket._id, authorId: agentUserId, body, visibility });
  if (visibility === 'customer_visible') {
    ticket.lastMessageAt = new Date();
    ticket.status = 'waiting_on_customer';
    await ticket.save();
  }
  return message;
}

export async function updateTicketStatus(
  agentUserId: string,
  agentRoles: string[],
  ticketId: string,
  status: 'resolved' | 'closed'
) {
  const ticket = await getTicketForAgent(agentUserId, agentRoles, ticketId);
  ticket.status = status;
  if (status === 'resolved') ticket.resolvedAt = new Date();
  await ticket.save();
  return ticket;
}
