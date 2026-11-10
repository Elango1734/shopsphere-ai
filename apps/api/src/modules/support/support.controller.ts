import type { Request, Response } from 'express';
import { sendSuccess, sendPaginated } from '../../http/envelope.js';
import { reqParam } from '../../http/reqParam.js';
import * as service from './support.service.js';
import { toTicketDto, toMessageDto } from './support.dto.js';

function pageParams(req: Request) {
  return req.query as unknown as { page: number; pageSize: number };
}

export async function createTicketHandler(req: Request, res: Response): Promise<void> {
  const ticket = await service.createTicket(req.auth!.userId, req.body as service.CreateTicketInput);
  sendSuccess(res, toTicketDto(ticket), { status: 201 });
}

export async function listMyTicketsHandler(req: Request, res: Response): Promise<void> {
  const { page, pageSize } = pageParams(req);
  const { tickets, totalItems } = await service.listMyTickets(req.auth!.userId, page, pageSize);
  sendPaginated(res, tickets.map(toTicketDto), { page, pageSize, totalItems });
}

export async function getMyTicketHandler(req: Request, res: Response): Promise<void> {
  const ticket = await service.getOwnedTicket(req.auth!.userId, reqParam(req, 'ticketId'));
  sendSuccess(res, toTicketDto(ticket));
}

export async function listMyMessagesHandler(req: Request, res: Response): Promise<void> {
  const messages = await service.listMessagesForOwnedTicket(req.auth!.userId, reqParam(req, 'ticketId'));
  sendSuccess(res, messages.map(toMessageDto));
}

export async function addCustomerMessageHandler(req: Request, res: Response): Promise<void> {
  const { body } = req.body as { body: string };
  const message = await service.addCustomerMessage(req.auth!.userId, reqParam(req, 'ticketId'), body);
  sendSuccess(res, toMessageDto(message), { status: 201 });
}

export async function listAssignedTicketsHandler(req: Request, res: Response): Promise<void> {
  const { page, pageSize } = pageParams(req);
  const { status } = req.query as unknown as { status?: string };
  const { tickets, totalItems } = await service.listAssignedTickets(req.auth!.userId, page, pageSize, status);
  sendPaginated(res, tickets.map(toTicketDto), { page, pageSize, totalItems });
}

export async function listUnassignedTicketsHandler(req: Request, res: Response): Promise<void> {
  const { page, pageSize } = pageParams(req);
  const { tickets, totalItems } = await service.listUnassignedTickets(page, pageSize);
  sendPaginated(res, tickets.map(toTicketDto), { page, pageSize, totalItems });
}

export async function assignTicketHandler(req: Request, res: Response): Promise<void> {
  const { assignedAgentId } = req.body as { assignedAgentId: string };
  const ticket = await service.assignTicket(req.auth!.userId, req.auth!.roles, reqParam(req, 'ticketId'), assignedAgentId);
  sendSuccess(res, toTicketDto(ticket));
}

export async function listAgentMessagesHandler(req: Request, res: Response): Promise<void> {
  const messages = await service.listAllMessagesForAgent(req.auth!.userId, req.auth!.roles, reqParam(req, 'ticketId'));
  sendSuccess(res, messages.map(toMessageDto));
}

export async function addAgentMessageHandler(req: Request, res: Response): Promise<void> {
  const { body, visibility } = req.body as { body: string; visibility: 'customer_visible' | 'internal_note' };
  const message = await service.addAgentMessage(req.auth!.userId, req.auth!.roles, reqParam(req, 'ticketId'), body, visibility);
  sendSuccess(res, toMessageDto(message), { status: 201 });
}

export async function updateTicketStatusHandler(req: Request, res: Response): Promise<void> {
  const { status } = req.body as { status: 'resolved' | 'closed' };
  const ticket = await service.updateTicketStatus(req.auth!.userId, req.auth!.roles, reqParam(req, 'ticketId'), status);
  sendSuccess(res, toTicketDto(ticket));
}
