import type { ApiClient } from '../core.js';
import type { OrderDetailDto, OrderSummaryDto, PaginationMeta, ReturnRequestDto, ShipmentDto } from '../types.js';

export function createOrdersModule(client: ApiClient) {
  return {
    listOrders: (page = 1, pageSize = 20) =>
      client.requestWithMeta<OrderSummaryDto[], { pagination: PaginationMeta }>('GET', '/orders', undefined, {
        query: { page, pageSize }
      }),
    getOrder: (orderId: string) => client.request<OrderDetailDto>('GET', `/orders/${orderId}`),
    cancelOrder: (orderId: string, reason?: string) =>
      client.request<OrderDetailDto>('POST', `/orders/${orderId}/cancel`, { reason }),
    listOrderShipments: (orderId: string) => client.request<ShipmentDto[]>('GET', `/orders/${orderId}/shipments`),

    listReturns: (page = 1, pageSize = 20) =>
      client.requestWithMeta<ReturnRequestDto[], { pagination: PaginationMeta }>('GET', '/returns', undefined, {
        query: { page, pageSize }
      }),
    getReturn: (returnId: string) => client.request<ReturnRequestDto>('GET', `/returns/${returnId}`),
    createReturn: (payload: { orderId: string; items: Array<{ variantId: string; quantity: number; reason?: string }>; reason?: string }) =>
      client.request<ReturnRequestDto>('POST', '/returns', payload)
  };
}
