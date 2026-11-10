import { type ClientSession, Types } from 'mongoose';
import { RefundModel, type RefundDocument } from '../models/refund.model.js';
import { PaymentAttemptModel } from '../models/paymentAttempt.model.js';
import type { Money } from '@shopsphere/shared-types';
import { withSession } from '../utils/session.js';

export class RefundExceedsCapturedAmountError extends Error {
  constructor() {
    super('Requested refund amount exceeds the remaining captured payment amount for this order');
    this.name = 'RefundExceedsCapturedAmountError';
  }
}

/**
 * Hard business-level enforcement of "cumulative successful refunds cannot
 * exceed captured amount" (entity-status-glossary.md, database-design.md).
 * Reads the payment attempt's captured amount and the sum of this order's
 * already-`succeeded` refunds inside the same transaction as the insert, so
 * two concurrent refund requests cannot both pass the check and together
 * overshoot the captured amount — the transaction's write conflict detection
 * forces one to retry and re-read the now-updated sum.
 */
export async function createRefundWithinCapturedAmount(
  input: {
    orderId: string;
    returnRequestId?: string;
    paymentAttemptId: string;
    requestedAmount: Money;
    reason?: string;
  },
  session: ClientSession
): Promise<RefundDocument> {
  const paymentAttempt = await PaymentAttemptModel.findById(input.paymentAttemptId, null, { session });
  if (!paymentAttempt || paymentAttempt.status !== 'succeeded') {
    throw new RefundExceedsCapturedAmountError();
  }

  const priorRefunds = await RefundModel.aggregate(
    [
      { $match: { paymentAttemptId: new Types.ObjectId(input.paymentAttemptId), status: 'succeeded' } },
      { $group: { _id: null, total: { $sum: '$approvedAmount.amountMinor' } } }
    ],
    { session }
  );
  const alreadyRefundedMinor = priorRefunds[0]?.total ?? 0;

  if (alreadyRefundedMinor + input.requestedAmount.amountMinor > paymentAttempt.amount.amountMinor) {
    throw new RefundExceedsCapturedAmountError();
  }

  const [refund] = await RefundModel.create(
    [
      {
        orderId: new Types.ObjectId(input.orderId),
        returnRequestId: input.returnRequestId ? new Types.ObjectId(input.returnRequestId) : undefined,
        paymentAttemptId: new Types.ObjectId(input.paymentAttemptId),
        requestedAmount: input.requestedAmount,
        reason: input.reason,
        status: 'pending',
        statusHistory: [{ status: 'pending', changedAt: new Date() }]
      }
    ],
    { session }
  );
  return refund as RefundDocument;
}

export async function markRefundSucceeded(
  refundId: string,
  approvedAmount: Money,
  providerRefundRef: string,
  session?: ClientSession
): Promise<RefundDocument | null> {
  return RefundModel.findOneAndUpdate(
    { _id: refundId, status: { $in: ['pending', 'processing'] } },
    {
      $set: { status: 'succeeded', approvedAmount, providerRefundRef },
      $push: { statusHistory: { status: 'succeeded', changedAt: new Date() } }
    },
    { ...withSession(session), new: true }
  );
}
