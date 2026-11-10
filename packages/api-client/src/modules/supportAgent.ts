import type { ApiClient } from '../core.js';
import type { PaginationMeta, SupportMessageDto, SupportTicketDto } from '../types.js';

export interface AgentTicketListQuery {
  page?: number;
  pageSize?: number;
  status?: 'open' | 'assigned' | 'waiting_on_customer' | 'resolved' | 'closed';
}

export function createSupportAgentModule(client: ApiClient) {
  return {
    listAssignedTickets: (query: AgentTicketListQuery = {}) =>
      client.requestWithMeta<SupportTicketDto[], { pagination: PaginationMeta }>('GET', '/support-agent/assigned', undefined, {
        query: query as Record<string, string | number | boolean | undefined>
      }),
    listUnassignedTickets: (page = 1, pageSize = 20) =>
      client.requestWithMeta<SupportTicketDto[], { pagination: PaginationMeta }>('GET', '/support-agent/unassigned', undefined, {
        query: { page, pageSize }
      }),
    assignTicket: (ticketId: string, assignedAgentId: string) =>
      client.request<SupportTicketDto>('POST', `/support-agent/tickets/${ticketId}/assign`, { assignedAgentId }),
    listMessages: (ticketId: string) => client.request<SupportMessageDto[]>('GET', `/support-agent/tickets/${ticketId}/messages`),
    addMessage: (ticketId: string, body: string, visibility: 'customer_visible' | 'internal_note' = 'customer_visible') =>
      client.request<SupportMessageDto>('POST', `/support-agent/tickets/${ticketId}/messages`, { body, visibility }),
    updateTicketStatus: (ticketId: string, status: 'resolved' | 'closed') =>
      client.request<SupportTicketDto>('PATCH', `/support-agent/tickets/${ticketId}/status`, { status })
  };
}
