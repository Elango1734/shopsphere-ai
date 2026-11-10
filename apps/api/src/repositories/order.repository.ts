import { type ClientSession, Types } from 'mongoose';
import { OrderModel, type OrderDocument, PAYMENT_STATUSES, FULFILLMENT_STATUSES } from '../models/order.model.js';
import type { PaymentStatus, FulfillmentStatus, Money, ProductSnapshot } from '@shopsphere/shared-types';
import { withSession } from '../utils/session.js';

export class DuplicateCheckoutError extends Error {
  constructor(public readonly existingOrderId: string) {
    super(`An order already exists for this checkout idempotency key: ${existingOrderId}`);
    this.name = 'DuplicateCheckoutError';
  }
}

export interface CreateOrderItemInput extends ProductSnapshot {
  taxAmount: Money;
  lineTotal: Money;
}

export interface CreateOrderInput {
  customerId: string;
  checkoutIdempotencyKey: string;
  items: CreateOrderItemInput[];
  itemSubtotal: Money;
  discountTotal: Money;
  taxTotal: Money;
  shippingTotal: Money;
  grandTotal: Money;
  shippingAddressSnapshot: Record<string, unknown>;
  billingAddressSnapshot?: Record<string, unknown>;
  appliedPromotions?: Array<{ kind: 'coupon' | 'promotion'; refId: string; code?: string; discountApplied: Money }>;
}

/**
 * Creates the order document for a checkout. The unique
 * (customerId, checkoutIdempotencyKey) index is the hard backstop: if a
 * retried checkout request races past the service-layer IdempotencyRecord
 * check, this insert still fails with a duplicate-key error, which is
 * translated into DuplicateCheckoutError rather than creating a second order.
 * Must run inside the same transaction as inventory reservation commits.
 */
export async function createOrder(input: CreateOrderInput, session: ClientSession): Promise<OrderDocument> {
  const sellerIds = [...new Set(input.items.map((item) => item.sellerId))];

  try {
    const [order] = await OrderModel.create(
      [
        {
          customerId: new Types.ObjectId(input.customerId),
          checkoutIdempotencyKey: input.checkoutIdempotencyKey,
          items: input.items,
          sellerIds: sellerIds.map((id) => new Types.ObjectId(id)),
          itemSubtotal: input.itemSubtotal,
          discountTotal: input.discountTotal,
          taxTotal: input.taxTotal,
          shippingTotal: input.shippingTotal,
          grandTotal: input.grandTotal,
          appliedPromotions: input.appliedPromotions ?? [],
          shippingAddressSnapshot: input.shippingAddressSnapshot,
          billingAddressSnapshot: input.billingAddressSnapshot,
          paymentStatus: 'pending',
          fulfillmentStatus: 'pending',
          statusHistory: [
            { track: 'payment', status: 'pending', changedAt: new Date() },
            { track: 'fulfillment', status: 'pending', changedAt: new Date() }
          ]
        }
      ],
      { session }
    );
    return order as OrderDocument;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      // The transaction's session is dead after a failed write inside it — querying with it here would hang
      // rather than error, since the server has no live transaction left to serve the read against. The
      // lookup below deliberately omits `session` and runs as an ordinary read after the transaction ends.
      const existing = await OrderModel.findOne({
        customerId: input.customerId,
        checkoutIdempotencyKey: input.checkoutIdempotencyKey
      });
      if (existing) {
        throw new DuplicateCheckoutError(existing._id.toString());
      }
    }
    throw error;
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code: number }).code === 11000);
}

// Guards against nonsensical jumps (e.g. 'pending' -> 'refunded' without ever being 'paid').
const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  pending: ['authorized', 'paid', 'failed', 'cancelled'],
  authorized: ['paid', 'failed', 'cancelled'],
  paid: ['partially_refunded', 'refunded'],
  failed: ['pending'],
  partially_refunded: ['refunded'],
  refunded: [],
  cancelled: []
};

const FULFILLMENT_TRANSITIONS: Record<FulfillmentStatus, readonly FulfillmentStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['partially_shipped', 'shipped', 'cancelled'],
  partially_shipped: ['shipped', 'return_requested'],
  shipped: ['delivered', 'return_requested'],
  delivered: ['return_requested'],
  cancelled: [],
  return_requested: ['returned'],
  returned: []
};

export class InvalidStatusTransitionError extends Error {
  constructor(track: string, from: string, to: string) {
    super(`Invalid ${track} transition: ${from} -> ${to}`);
    this.name = 'InvalidStatusTransitionError';
  }
}

export async function transitionPaymentStatus(
  orderId: string,
  to: PaymentStatus,
  options: { changedBy?: string; note?: string; session?: ClientSession } = {}
): Promise<OrderDocument> {
  const order = await OrderModel.findById(orderId, null, withSession(options.session));
  if (!order) throw new Error(`Order ${orderId} not found`);

  const allowed = PAYMENT_TRANSITIONS[order.paymentStatus as PaymentStatus] ?? [];
  if (!allowed.includes(to)) {
    throw new InvalidStatusTransitionError('payment', order.paymentStatus, to);
  }

  order.paymentStatus = to;
  order.statusHistory.push({
    track: 'payment',
    status: to,
    changedAt: new Date(),
    ...(options.changedBy ? { changedBy: new Types.ObjectId(options.changedBy) } : {}),
    ...(options.note ? { note: options.note } : {})
  });
  await order.save(withSession(options.session));
  return order;
}

export async function transitionFulfillmentStatus(
  orderId: string,
  to: FulfillmentStatus,
  options: { changedBy?: string; note?: string; session?: ClientSession } = {}
): Promise<OrderDocument> {
  const order = await OrderModel.findById(orderId, null, withSession(options.session));
  if (!order) throw new Error(`Order ${orderId} not found`);

  const allowed = FULFILLMENT_TRANSITIONS[order.fulfillmentStatus as FulfillmentStatus] ?? [];
  if (!allowed.includes(to)) {
    throw new InvalidStatusTransitionError('fulfillment', order.fulfillmentStatus, to);
  }

  order.fulfillmentStatus = to;
  order.statusHistory.push({
    track: 'fulfillment',
    status: to,
    changedAt: new Date(),
    ...(options.changedBy ? { changedBy: new Types.ObjectId(options.changedBy) } : {}),
    ...(options.note ? { note: options.note } : {})
  });
  await order.save(withSession(options.session));
  return order;
}

export async function findOrderById(orderId: string): Promise<OrderDocument | null> {
  return OrderModel.findById(orderId);
}

export async function listOrdersForCustomer(
  customerId: string,
  page: number,
  pageSize: number
): Promise<{ orders: OrderDocument[]; totalItems: number }> {
  const skip = (page - 1) * pageSize;
  const [orders, totalItems] = await Promise.all([
    OrderModel.find({ customerId }).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(pageSize),
    OrderModel.countDocuments({ customerId })
  ]);
  return { orders, totalItems };
}

export async function listOrdersForSeller(
  sellerId: string,
  page: number,
  pageSize: number,
  fulfillmentStatus?: FulfillmentStatus
): Promise<{ orders: OrderDocument[]; totalItems: number }> {
  const filter: Record<string, unknown> = { sellerIds: sellerId };
  if (fulfillmentStatus) filter.fulfillmentStatus = fulfillmentStatus;
  const skip = (page - 1) * pageSize;
  const [orders, totalItems] = await Promise.all([
    OrderModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(pageSize),
    OrderModel.countDocuments(filter)
  ]);
  return { orders, totalItems };
}

export { PAYMENT_STATUSES, FULFILLMENT_STATUSES };
