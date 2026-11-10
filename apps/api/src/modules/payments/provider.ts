export interface ChargeInput {
  orderId: string;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
  simulate?: 'success' | 'failure';
}

export interface ChargeResult {
  status: 'succeeded' | 'failed';
  providerPaymentRef?: string;
  failureReason?: string;
}

export interface RefundInput {
  providerPaymentRef: string;
  amountMinor: number;
  currency: string;
}

export interface RefundResult {
  status: 'succeeded' | 'failed';
  providerRefundRef?: string;
  failureReason?: string;
}

/**
 * The provider abstraction every payment integration implements.
 * architecture.md requires this seam to exist independent of which provider
 * is configured; only `DevelopmentPaymentProvider` (developmentProvider.ts)
 * is implemented in this stage, clearly labeled and gated by
 * `PAYMENT_PROVIDER=development` — see security.md: "never represent
 * simulated payments as real payments."
 */
export interface PaymentProvider {
  readonly name: string;
  charge(input: ChargeInput): Promise<ChargeResult>;
  refund(input: RefundInput): Promise<RefundResult>;
}
