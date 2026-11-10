import type { ApiClient } from '../core.js';
import type { ReviewDto } from '../types.js';

export interface CreateReviewPayload {
  orderId: string;
  orderItemVariantId: string;
  rating: number;
  title?: string;
  body?: string;
}

export function createReviewsModule(client: ApiClient) {
  return {
    createReview: (payload: CreateReviewPayload) => client.request<ReviewDto>('POST', '/reviews', payload)
  };
}
