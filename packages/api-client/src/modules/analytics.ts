import type { ApiClient } from '../core.js';

export type AnalyticsEventType =
  | 'session_start'
  | 'product_view'
  | 'search'
  | 'add_to_cart'
  | 'checkout_start'
  | 'order_placed';

export interface AnalyticsEventPayload {
  type: AnalyticsEventType;
  sessionId: string;
  productId?: string;
  categoryId?: string;
  /** Result count only — never the shopper's search text, which the API does not accept. */
  resultCount?: number;
  occurredAt?: string;
}

export function createAnalyticsModule(client: ApiClient) {
  return {
    /** Batched; the API accepts up to 50 events per call and returns only the accepted count. */
    recordEvents: (events: AnalyticsEventPayload[]) =>
      client.request<{ accepted: number }>('POST', '/analytics/events', { events })
  };
}
