import { Types } from 'mongoose';
import { OrderModel, type OrderDocument } from '../../models/order.model.js';
import { ShipmentModel } from '../../models/shipment.model.js';
import { ReturnRequestModel, type ReturnRequestDocument } from '../../models/returnRequest.model.js';
import { listOrdersForCustomer, transitionFulfillmentStatus, transitionPaymentStatus } from '../../repositories/order.repository.js';
import { restockVariant } from '../../repositories/inventory.repository.js';
import { recomputeProductPriceAndStockCache } from '../../repositories/product.repository.js';
import { NotFoundError, ForbiddenError, UnprocessableError } from '../../http/errors.js';

export async function listMyOrders(userId: string, page: number, pageSize: number) {
  return listOrdersForCustomer(userId, page, pageSize);
}

export async function getOwnedOrder(userId: string, orderId: string): Promise<OrderDocument> {
  const order = await OrderModel.findById(orderId);
  if (!order) throw new NotFoundError('Order not found');
  if (order.customerId.toString() !== userId) throw new ForbiddenError();
  return order;
}

const CANCELLABLE_FULFILLMENT_STATUSES = new Set(['pending', 'confirmed']);

/**
 * Cancellation restocks committed inventory (database-design.md's checkout
 * flow commits stock at order creation, independent of payment outcome), so
 * cancelling must give it back explicitly rather than relying on the
 * reservation-release path, which only applies to still-active reservations
 * from an in-flight checkout.
 */
export async function cancelOwnedOrder(userId: string, orderId: string, reason?: string): Promise<OrderDocument> {
  const order = await getOwnedOrder(userId, orderId);
  if (!CANCELLABLE_FULFILLMENT_STATUSES.has(order.fulfillmentStatus)) {
    throw new UnprocessableError('ORDER_NOT_CANCELLABLE', 'This order can no longer be cancelled');
  }

  for (const item of order.items) {
    await restockVariant(item.variantId.toString(), item.quantity);
  }

  await transitionFulfillmentStatus(orderId, 'cancelled', { changedBy: userId, ...(reason ? { note: reason } : {}) });
  if (order.paymentStatus === 'pending' || order.paymentStatus === 'authorized') {
    await transitionPaymentStatus(orderId, 'cancelled', { changedBy: userId });
  }

  for (const item of order.items) {
    await recomputeProductPriceAndStockCache(item.productId.toString());
  }

  const updated = await OrderModel.findById(orderId);
  if (reason) updated!.cancelReason = reason;
  await updated!.save();
  return updated!;
}

export async function listShipmentsForOrder(userId: string, orderId: string) {
  await getOwnedOrder(userId, orderId);
  return ShipmentModel.find({ orderId }).sort({ createdAt: 1 });
}

export interface CreateReturnInput {
  orderId: string;
  items: Array<{ variantId: string; quantity: number; reason?: string }>;
  reason?: string;
}

export async function createReturnRequest(userId: string, input: CreateReturnInput): Promise<ReturnRequestDocument> {
  const order = await getOwnedOrder(userId, input.orderId);
  if (order.fulfillmentStatus !== 'delivered') {
    throw new UnprocessableError('RETURN_NOT_ELIGIBLE', 'Only delivered orders are eligible for return');
  }

  const orderVariantQuantities = new Map(order.items.map((i) => [i.variantId.toString(), i.quantity]));
  for (const item of input.items) {
    const purchasedQuantity = orderVariantQuantities.get(item.variantId);
    if (!purchasedQuantity || item.quantity > purchasedQuantity) {
      throw new UnprocessableError('RETURN_NOT_ELIGIBLE', 'Return quantity exceeds what was purchased');
    }
  }

  const requestedAmountMinor = input.items.reduce((sum, item) => {
    const orderItem = order.items.find((i) => i.variantId.toString() === item.variantId)!;
    return sum + (orderItem.unitPrice.amountMinor - orderItem.discount.amountMinor / orderItem.quantity) * item.quantity;
  }, 0);

  const returnRequest = await ReturnRequestModel.create({
    orderId: order._id,
    customerId: new Types.ObjectId(userId),
    items: input.items,
    requestedAmount: { amountMinor: Math.round(requestedAmountMinor), currency: order.grandTotal.currency },
    reason: input.reason,
    status: 'requested',
    statusHistory: [{ status: 'requested', changedAt: new Date() }]
  });

  await transitionFulfillmentStatus(order._id.toString(), 'return_requested', { changedBy: userId });
  return returnRequest;
}

export async function getOwnedReturnRequest(userId: string, returnId: string) {
  const returnRequest = await ReturnRequestModel.findById(returnId);
  if (!returnRequest) throw new NotFoundError('Return request not found');
  if (returnRequest.customerId.toString() !== userId) throw new ForbiddenError();
  return returnRequest;
}

export async function listMyReturnRequests(userId: string, page: number, pageSize: number) {
  const skip = (page - 1) * pageSize;
  const [returns, totalItems] = await Promise.all([
    ReturnRequestModel.find({ customerId: userId }).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
    ReturnRequestModel.countDocuments({ customerId: userId })
  ]);
  return { returns, totalItems };
}
