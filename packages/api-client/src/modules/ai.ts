import type { ApiClient } from '../core.js';
import type { AiMessageDto, AiReplyDto, ProductSummaryDto, ReviewSummaryDto } from '../types.js';

export function createAiModule(client: ApiClient) {
  return {
    discovery: (message: string, conversationId?: string) =>
      client.request<AiReplyDto>('POST', '/ai/discovery', { message, conversationId }),
    compare: (productIds: string[], conversationId?: string) =>
      client.request<AiReplyDto>('POST', '/ai/compare', { productIds, conversationId }),
    support: (message: string, orderId?: string, conversationId?: string) =>
      client.request<AiReplyDto>('POST', '/ai/support', { message, orderId, conversationId }),
    getHistory: (conversationId: string) => client.request<AiMessageDto[]>('GET', `/ai/conversations/${conversationId}`),
    deleteHistory: (conversationId: string) =>
      client.request<{ deleted: boolean }>('DELETE', `/ai/conversations/${conversationId}`),
    getRelatedProducts: (slug: string) => client.request<ProductSummaryDto[]>('GET', `/ai/products/${encodeURIComponent(slug)}/related`),
    getReviewSummary: (slug: string) =>
      client.request<ReviewSummaryDto>('GET', `/ai/products/${encodeURIComponent(slug)}/review-summary`)
  };
}
