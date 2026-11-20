import type { ApiClient } from '../core.js';
import type {
  LowStockItemDto,
  OrderDetailDto,
  OrderSummaryDto,
  PaginationMeta,
  SellerAnalyticsOverviewDto,
  SellerDailyReportDto,
  SellerDto,
  SellerProductDto,
  SellerVariantDto,
  ShipmentDto
} from '../types.js';

export interface OnboardSellerPayload {
  storeName: string;
  description?: string;
  supportEmail?: string;
}

export interface CreateSellerProductPayload {
  categoryId: string;
  brandId?: string;
  name: string;
  description?: string;
  attributes?: Array<{ name: string; value: string }>;
  images?: Array<{ storageKey: string; altText?: string; sortOrder?: number }>;
  returnPolicyRef?: string;
  warrantyPolicyRef?: string;
}

export interface CreateSellerVariantPayload {
  sku: string;
  attributes?: Record<string, string>;
  regularPrice: { amountMinor: number; currency: string };
  salePrice?: { amountMinor: number; currency: string };
  weightGrams?: number;
  barcodeGtin?: string;
  imageStorageKey?: string;
  initialOnHand?: number;
}

export interface SellerOrderListQuery {
  page?: number;
  pageSize?: number;
  fulfillmentStatus?: string;
}

export function createSellerModule(client: ApiClient) {
  return {
    onboard: (payload: OnboardSellerPayload) => client.request<SellerDto>('POST', '/seller/onboard', payload),
    getMe: () => client.request<SellerDto>('GET', '/seller/me'),

    getAnalyticsOverview: (rangeDays = 30) =>
      client.request<SellerAnalyticsOverviewDto>('GET', '/seller/analytics/overview', undefined, { query: { rangeDays } }),

    /** `date` is a UTC YYYY-MM-DD; omitted means yesterday, decided server-side. */
    getDailyReport: (date?: string) =>
      client.request<SellerDailyReportDto>('GET', '/seller/ai/daily-report', undefined, { query: date ? { date } : {} }),

    listProducts: (page = 1, pageSize = 20) =>
      client.requestWithMeta<SellerProductDto[], { pagination: PaginationMeta }>('GET', '/seller/products', undefined, {
        query: { page, pageSize }
      }),
    createProduct: (payload: CreateSellerProductPayload) => client.request<SellerProductDto>('POST', '/seller/products', payload),
    updateProduct: (productId: string, patch: Partial<CreateSellerProductPayload>) =>
      client.request<SellerProductDto>('PATCH', `/seller/products/${productId}`, patch),
    submitProductForReview: (productId: string) => client.request<SellerProductDto>('POST', `/seller/products/${productId}/submit`),

    listVariants: (productId: string) => client.request<SellerVariantDto[]>('GET', `/seller/products/${productId}/variants`),
    createVariant: (productId: string, payload: CreateSellerVariantPayload) =>
      client.request<SellerVariantDto>('POST', `/seller/products/${productId}/variants`, payload),
    updateVariant: (variantId: string, patch: Partial<CreateSellerVariantPayload>) =>
      client.request<SellerVariantDto>('PATCH', `/seller/variants/${variantId}`, patch),
    updateInventory: (variantId: string, onHand: number, lowStockThreshold?: number) =>
      client.request<{ updated: boolean }>('PATCH', `/seller/variants/${variantId}/inventory`, { onHand, lowStockThreshold }),

    listLowStock: () => client.request<LowStockItemDto[]>('GET', '/seller/inventory/low-stock'),

    listOrders: (query: SellerOrderListQuery = {}) =>
      client.requestWithMeta<OrderSummaryDto[], { pagination: PaginationMeta }>('GET', '/seller/orders', undefined, {
        query: query as Record<string, string | number | boolean | undefined>
      }),
    getOrder: (orderId: string) => client.request<OrderDetailDto>('GET', `/seller/orders/${orderId}`),
    updateFulfillment: (orderId: string, status: string, note?: string) =>
      client.request<OrderDetailDto>('PATCH', `/seller/orders/${orderId}/fulfillment`, { status, note }),
    createShipment: (orderId: string, payload: { carrier?: string; trackingNumber?: string; variantIds: string[] }) =>
      client.request<ShipmentDto>('POST', `/seller/orders/${orderId}/shipments`, payload)
  };
}
