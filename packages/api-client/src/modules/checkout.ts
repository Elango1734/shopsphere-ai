import type { ApiClient } from '../core.js';
import type { AddressFields, CheckoutResultDto } from '../types.js';

export interface CheckoutPayload {
  shippingAddressId?: string;
  shippingAddress?: AddressFields;
  couponCode?: string;
  paymentMethod?: 'development_card';
  /** Development-provider-only testing hook; omit in production builds. */
  simulate?: 'success' | 'failure';
}

export function createCheckoutModule(client: ApiClient) {
  return {
    /**
     * `idempotencyKey` must be caller-generated and stable across retries of
     * the SAME logical checkout attempt (e.g. one per tap of "Place order",
     * reused automatically by retry logic) — api-specification.md's
     * Idempotency-Key contract. Never generate a new one on automatic retry.
     */
    checkout: (payload: CheckoutPayload, idempotencyKey: string) =>
      client.request<CheckoutResultDto>('POST', '/checkout', payload, { idempotencyKey })
  };
}
