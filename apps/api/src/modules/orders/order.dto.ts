import type { OrderDocument } from '../../models/order.model.js';
import type { ShipmentDocument } from '../../models/shipment.model.js';
import type { ReturnRequestDocument } from '../../models/returnRequest.model.js';
import { toPublicId } from '../../utils/ids.js';

export function toOrderSummaryDto(order: OrderDocument) {
  return {
    id: toPublicId(order._id),
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    grandTotal: order.grandTotal,
    itemCount: order.items.length,
    placedAt: order.placedAt.toISOString()
  };
}

export function toOrderDetailDto(order: OrderDocument) {
  return {
    ...toOrderSummaryDto(order),
    items: order.items.map((item) => ({
      productId: toPublicId(item.productId),
      variantId: toPublicId(item.variantId),
      sellerId: toPublicId(item.sellerId),
      name: item.name,
      sku: item.sku,
      attributes: Object.fromEntries(item.attributes),
      unitPrice: item.unitPrice,
      discount: item.discount,
      taxAmount: item.taxAmount,
      quantity: item.quantity,
      lineTotal: item.lineTotal
    })),
    itemSubtotal: order.itemSubtotal,
    discountTotal: order.discountTotal,
    taxTotal: order.taxTotal,
    shippingTotal: order.shippingTotal,
    shippingAddress: order.shippingAddressSnapshot,
    statusHistory: order.statusHistory.map((h) => ({ track: h.track, status: h.status, changedAt: h.changedAt.toISOString(), note: h.note })),
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    cancelReason: order.cancelReason ?? null
  };
}

export function toShipmentDto(shipment: ShipmentDocument) {
  return {
    id: toPublicId(shipment._id),
    orderId: toPublicId(shipment.orderId),
    sellerId: toPublicId(shipment.sellerId),
    carrier: shipment.carrier,
    trackingNumber: shipment.trackingNumber,
    status: shipment.status,
    trackingEvents: shipment.trackingEvents.map((e) => ({ status: e.status, description: e.description, location: e.location, occurredAt: e.occurredAt.toISOString() })),
    shippedAt: shipment.shippedAt?.toISOString() ?? null,
    deliveredAt: shipment.deliveredAt?.toISOString() ?? null
  };
}

export function toReturnRequestDto(returnRequest: ReturnRequestDocument) {
  return {
    id: toPublicId(returnRequest._id),
    orderId: toPublicId(returnRequest.orderId),
    status: returnRequest.status,
    items: returnRequest.items.map((i) => ({ variantId: toPublicId(i.variantId), quantity: i.quantity, reason: i.reason })),
    requestedAmount: returnRequest.requestedAmount,
    approvedAmount: returnRequest.approvedAmount ?? null,
    reason: returnRequest.reason,
    statusHistory: returnRequest.statusHistory.map((h) => ({ status: h.status, changedAt: h.changedAt.toISOString(), note: h.note })),
    createdAt: returnRequest.createdAt.toISOString()
  };
}
