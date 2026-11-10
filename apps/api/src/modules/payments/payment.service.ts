import type { Money } from '@shopsphere/shared-types';
import { PaymentAttemptModel, type PaymentAttemptDocument } from '../../models/paymentAttempt.model.js';
import { OrderModel } from '../../models/order.model.js';
import { RefundModel } from '../../models/refund.model.js';
import { transitionPaymentStatus, findOrderById } from '../../repositories/order.repository.js';
import { createRefundWithinCapturedAmount, markRefundSucceeded } from '../../repositories/refund.repository.js';
import { withTransaction } from '../../db/transaction.js';
import { getPaymentProvider } from './developmentProvider.js';

/**
 * The provider call happens outside any database transaction
 * (database-design.md: "External payment calls do not occur inside a
 * long-running database transaction"). The PaymentAttempt record is created
 * first in a 'pending' state so a crash between creating it and getting the
 * provider's answer leaves an auditable, reconcilable trace rather than
 * nothing. A client redirect or the mobile app reporting "success" is never
 * what flips payment state — only this function (or a verified webhook)
 * does, and the order's own `paymentStatus` transition guard rejects an
 * invalid jump regardless.
 */
export async function chargeOrder(orderId: string, amount: Money, idempotencyKey: string, simulate: 'success' | 'failure') {
  const provider = getPaymentProvider();

  let paymentAttempt: PaymentAttemptDocument | null = await PaymentAttemptModel.findOne({
    provider: provider.name,
    idempotencyKey
  });
  if (!paymentAttempt) {
    paymentAttempt = await PaymentAttemptModel.create({ orderId, provider: provider.name, amount, status: 'pending', idempotencyKey });
  }

  if (paymentAttempt.status === 'succeeded') {
    // Idempotent retry of an already-succeeded charge: the order may already be 'paid', in which case
    // transitioning again would be an invalid no-op jump — just return the current state.
    const existingOrder = await findOrderById(orderId);
    if (!existingOrder) throw new Error(`Order ${orderId} not found`);
    const order = existingOrder.paymentStatus === 'paid' ? existingOrder : await transitionPaymentStatus(orderId, 'paid');
    return { order, paymentAttemptId: paymentAttempt._id.toString() };
  }

  const result = await provider.charge({
    orderId,
    amountMinor: amount.amountMinor,
    currency: amount.currency,
    idempotencyKey,
    simulate
  });

  if (result.status === 'succeeded') {
    paymentAttempt.status = 'succeeded';
    if (result.providerPaymentRef) paymentAttempt.providerPaymentRef = result.providerPaymentRef;
    paymentAttempt.confirmedAt = new Date();
    await paymentAttempt.save();
    const order = await transitionPaymentStatus(orderId, 'paid', { note: `Captured via ${provider.name} provider` });
    return { order, paymentAttemptId: paymentAttempt._id.toString() };
  }

  paymentAttempt.status = 'failed';
  if (result.failureReason) paymentAttempt.failureReason = result.failureReason;
  await paymentAttempt.save();
  const order = await transitionPaymentStatus(orderId, 'failed', {
    ...(result.failureReason ? { note: result.failureReason } : {})
  });
  return { order, paymentAttemptId: paymentAttempt._id.toString() };
}

export async function issueRefund(input: {
  orderId: string;
  paymentAttemptId: string;
  returnRequestId?: string;
  requestedAmount: Money;
  reason?: string;
}) {
  const paymentAttempt = await PaymentAttemptModel.findById(input.paymentAttemptId);
  if (!paymentAttempt || !paymentAttempt.providerPaymentRef) {
    throw new Error('Cannot refund a payment attempt with no provider reference');
  }

  const refund = await withTransaction((session) => createRefundWithinCapturedAmount(input, session));

  const provider = getPaymentProvider();
  const result = await provider.refund({
    providerPaymentRef: paymentAttempt.providerPaymentRef,
    amountMinor: input.requestedAmount.amountMinor,
    currency: input.requestedAmount.currency
  });

  if (result.status === 'succeeded' && result.providerRefundRef) {
    await markRefundSucceeded(refund._id.toString(), input.requestedAmount, result.providerRefundRef);
    const newPaymentStatus = await isFullyRefunded(input.orderId, input.requestedAmount.currency)
      ? 'refunded'
      : 'partially_refunded';
    await transitionPaymentStatus(input.orderId, newPaymentStatus, { note: 'Refund succeeded' });
  }

  return refund;
}

async function isFullyRefunded(orderId: string, currency: string): Promise<boolean> {
  const order = await OrderModel.findById(orderId).select('grandTotal');
  if (!order) return false;

  const [agg] = await RefundModel.aggregate([
    { $match: { orderId: order._id, status: 'succeeded' } },
    { $group: { _id: null, total: { $sum: '$approvedAmount.amountMinor' } } }
  ]);
  const refundedMinor = agg?.total ?? 0;
  return refundedMinor >= order.grandTotal.amountMinor && order.grandTotal.currency === currency;
}
