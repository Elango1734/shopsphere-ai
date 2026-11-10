import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { Types } from 'mongoose';
import { startMemoryReplicaSet, stopMemoryReplicaSet, clearAllCollections } from '../setup/memoryReplSet.js';
import { PaymentAttemptModel } from '../../src/models/paymentAttempt.model.js';
import { withTransaction } from '../../src/db/transaction.js';
import {
  createRefundWithinCapturedAmount,
  markRefundSucceeded,
  RefundExceedsCapturedAmountError
} from '../../src/repositories/refund.repository.js';

beforeAll(async () => {
  await startMemoryReplicaSet();
}, 120_000);
afterAll(async () => {
  await stopMemoryReplicaSet();
});
afterEach(async () => {
  await clearAllCollections();
});

async function seedSucceededPayment(amountMinor: number) {
  return PaymentAttemptModel.create({
    orderId: new Types.ObjectId(),
    provider: 'development',
    amount: { amountMinor, currency: 'USD' },
    status: 'succeeded',
    idempotencyKey: `pay-${new Types.ObjectId().toString()}`
  });
}

describe('Refund cannot exceed captured payment amount (entity-status-glossary.md)', () => {
  it('allows a refund up to the full captured amount', async () => {
    const payment = await seedSucceededPayment(5000);
    const refund = await withTransaction((session) =>
      createRefundWithinCapturedAmount(
        { orderId: payment.orderId.toString(), paymentAttemptId: payment._id.toString(), requestedAmount: { amountMinor: 5000, currency: 'USD' } },
        session
      )
    );
    expect(refund.status).toBe('pending');
  });

  it('rejects a single refund request exceeding the captured amount', async () => {
    const payment = await seedSucceededPayment(5000);
    await expect(
      withTransaction((session) =>
        createRefundWithinCapturedAmount(
          { orderId: payment.orderId.toString(), paymentAttemptId: payment._id.toString(), requestedAmount: { amountMinor: 5001, currency: 'USD' } },
          session
        )
      )
    ).rejects.toThrow(RefundExceedsCapturedAmountError);
  });

  it('rejects a second partial refund once prior succeeded refunds already consumed the captured amount', async () => {
    const payment = await seedSucceededPayment(5000);

    const first = await withTransaction((session) =>
      createRefundWithinCapturedAmount(
        { orderId: payment.orderId.toString(), paymentAttemptId: payment._id.toString(), requestedAmount: { amountMinor: 3000, currency: 'USD' } },
        session
      )
    );
    await markRefundSucceeded(first._id.toString(), { amountMinor: 3000, currency: 'USD' }, 'provider-ref-1');

    // 3000 already refunded + 2001 requested > 5000 captured -> must reject.
    await expect(
      withTransaction((session) =>
        createRefundWithinCapturedAmount(
          { orderId: payment.orderId.toString(), paymentAttemptId: payment._id.toString(), requestedAmount: { amountMinor: 2001, currency: 'USD' } },
          session
        )
      )
    ).rejects.toThrow(RefundExceedsCapturedAmountError);

    // Exactly the remaining 2000 must still be allowed.
    await expect(
      withTransaction((session) =>
        createRefundWithinCapturedAmount(
          { orderId: payment.orderId.toString(), paymentAttemptId: payment._id.toString(), requestedAmount: { amountMinor: 2000, currency: 'USD' } },
          session
        )
      )
    ).resolves.toBeDefined();
  });

  it('rejects a refund against a payment attempt that has not succeeded', async () => {
    const payment = await PaymentAttemptModel.create({
      orderId: new Types.ObjectId(),
      provider: 'development',
      amount: { amountMinor: 5000, currency: 'USD' },
      status: 'pending',
      idempotencyKey: `pay-${new Types.ObjectId().toString()}`
    });

    await expect(
      withTransaction((session) =>
        createRefundWithinCapturedAmount(
          { orderId: payment.orderId.toString(), paymentAttemptId: payment._id.toString(), requestedAmount: { amountMinor: 100, currency: 'USD' } },
          session
        )
      )
    ).rejects.toThrow(RefundExceedsCapturedAmountError);
  });
});
