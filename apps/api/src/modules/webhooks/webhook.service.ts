import { Types } from 'mongoose';
import { WebhookEventModel } from '../../models/webhookEvent.model.js';
import { PaymentAttemptModel } from '../../models/paymentAttempt.model.js';
import { transitionPaymentStatus } from '../../repositories/order.repository.js';
import { InvalidStatusTransitionError } from '../../repositories/order.repository.js';
import { ValidationError, UnauthorizedError, UnprocessableError } from '../../http/errors.js';
import { verifyWebhookSignature } from './signature.js';

export interface PaymentWebhookPayload {
  eventId: string;
  eventType: 'payment.succeeded' | 'payment.failed';
  orderId: string;
  paymentAttemptId: string;
  amountMinor: number;
  currency: string;
}

function isPaymentWebhookPayload(value: unknown): value is PaymentWebhookPayload {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.eventId === 'string' &&
    (v.eventType === 'payment.succeeded' || v.eventType === 'payment.failed') &&
    typeof v.orderId === 'string' &&
    typeof v.paymentAttemptId === 'string' &&
    typeof v.amountMinor === 'number' &&
    typeof v.currency === 'string'
  );
}

/**
 * Processes one inbound payment-provider webhook delivery end to end:
 * signature verification against the raw body, event-ID dedup (so a
 * replayed/duplicated delivery is a no-op), amount/currency/order-association
 * validation, and an idempotent, out-of-order-safe state transition. Nothing
 * here ever marks an order paid from anything other than this verified path
 * (api-specification.md).
 */
export async function processPaymentWebhook(
  provider: string,
  rawBody: Buffer,
  signatureHeader: string | undefined
): Promise<{ status: 'processed' | 'duplicate' | 'ignored' }> {
  if (!verifyWebhookSignature(rawBody, signatureHeader)) {
    throw new UnauthorizedError('Invalid webhook signature');
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw new ValidationError([{ code: 'INVALID_PAYLOAD', message: 'Webhook body is not valid JSON' }]);
  }
  if (!isPaymentWebhookPayload(payload)) {
    throw new ValidationError([{ code: 'INVALID_PAYLOAD', message: 'Webhook payload is missing required fields' }]);
  }

  try {
    await WebhookEventModel.create({
      provider,
      providerEventId: payload.eventId,
      eventType: payload.eventType,
      status: 'received',
      relatedOrderId: new Types.ObjectId(payload.orderId),
      rawPayload: { amountMinor: payload.amountMinor, currency: payload.currency }
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return { status: 'duplicate' };
    }
    throw error;
  }

  const paymentAttempt = await PaymentAttemptModel.findById(payload.paymentAttemptId);
  const associationValid =
    paymentAttempt != null &&
    paymentAttempt.orderId.toString() === payload.orderId &&
    paymentAttempt.amount.amountMinor === payload.amountMinor &&
    paymentAttempt.amount.currency === payload.currency;

  if (!paymentAttempt || !associationValid) {
    await WebhookEventModel.updateOne(
      { provider, providerEventId: payload.eventId },
      { $set: { status: 'failed', processingError: 'Amount/currency/order association mismatch', processedAt: new Date() } }
    );
    throw new UnprocessableError('PAYMENT_MISMATCH', 'Webhook amount/currency/order does not match the payment attempt');
  }

  try {
    if (payload.eventType === 'payment.succeeded') {
      if (paymentAttempt.status !== 'succeeded') {
        paymentAttempt.status = 'succeeded';
        paymentAttempt.confirmedAt = new Date();
        await paymentAttempt.save();
      }
      await transitionPaymentStatus(payload.orderId, 'paid', { note: `Confirmed via ${provider} webhook` });
    } else {
      if (paymentAttempt.status !== 'failed') {
        paymentAttempt.status = 'failed';
        await paymentAttempt.save();
      }
      await transitionPaymentStatus(payload.orderId, 'failed', { note: `Reported via ${provider} webhook` });
    }
  } catch (error) {
    if (error instanceof InvalidStatusTransitionError) {
      // Out-of-order or already-applied event (e.g. order already 'paid'): treat as a benign no-op, not a failure —
      // retrying this event forever would otherwise be the provider's natural response to an error status.
      await WebhookEventModel.updateOne(
        { provider, providerEventId: payload.eventId },
        { $set: { status: 'ignored', processingError: error.message, processedAt: new Date() } }
      );
      return { status: 'ignored' };
    }
    throw error;
  }

  await WebhookEventModel.updateOne(
    { provider, providerEventId: payload.eventId },
    { $set: { status: 'processed', processedAt: new Date() } }
  );
  return { status: 'processed' };
}

function isDuplicateKeyError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code: number }).code === 11000);
}
