import type { ApiClient } from '../core.js';
import type { PaginationMeta, SupportMessageDto, SupportTicketDto } from '../types.js';

export interface CreateTicketPayload {
  category: 'order' | 'payment' | 'return' | 'account' | 'product' | 'other';
  subject: string;
  orderId?: string;
  message: string;
}

export function createSupportModule(client: ApiClient) {
  return {
    createTicket: (payload: CreateTicketPayload) => client.request<SupportTicketDto>('POST', '/support/tickets', payload),
    listTickets: (page = 1, pageSize = 20) =>
      client.requestWithMeta<SupportTicketDto[], { pagination: PaginationMeta }>('GET', '/support/tickets', undefined, {
        query: { page, pageSize }
      }),
    getTicket: (ticketId: string) => client.request<SupportTicketDto>('GET', `/support/tickets/${ticketId}`),
    listMessages: (ticketId: string) => client.request<SupportMessageDto[]>('GET', `/support/tickets/${ticketId}/messages`),
    addMessage: (ticketId: string, body: string) =>
      client.request<SupportMessageDto>('POST', `/support/tickets/${ticketId}/messages`, { body })
  };
}
