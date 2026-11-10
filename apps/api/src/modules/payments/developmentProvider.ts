import { nanoid } from 'nanoid';
import type { PaymentProvider, ChargeInput, ChargeResult, RefundInput, RefundResult } from './provider.js';

/**
 * Development-only simulated provider: never contacts a real network
 * endpoint, never handles a real card, and is the ONLY provider this stage
 * implements (real credentials/account integration is blocked per
 * docs/task-checklist.md). `input.simulate` is the test hook that lets
 * callers deterministically exercise the failure path — a real adapter has
 * no such parameter.
 */
export class DevelopmentPaymentProvider implements PaymentProvider {
  readonly name = 'development';

  async charge(input: ChargeInput): Promise<ChargeResult> {
    if (input.simulate === 'failure') {
      return { status: 'failed', failureReason: 'Simulated decline (development provider)' };
    }
    return { status: 'succeeded', providerPaymentRef: `dev_pay_${nanoid(24)}` };
  }

  async refund(_input: RefundInput): Promise<RefundResult> {
    return { status: 'succeeded', providerRefundRef: `dev_refund_${nanoid(24)}` };
  }
}

let instance: PaymentProvider | undefined;

export function getPaymentProvider(): PaymentProvider {
  if (!instance) instance = new DevelopmentPaymentProvider();
  return instance;
}
