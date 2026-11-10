import type { ApiClient } from '../core.js';
import type {
  AdminProductDto,
  AiAdminOverviewDto,
  AiConversationDetailDto,
  AiConversationSummaryDto,
  AnalyticsOverviewDto,
  AuditLogDto,
  BrandDto,
  CategoryDto,
  CouponDto,
  OrderDetailDto,
  OrderSummaryDto,
  PaginationMeta,
  PaymentAttemptDto,
  ReturnRequestDto,
  ReviewDto,
  SellerDetailDto,
  SellerDto,
  UserDetailDto,
  UserDto
} from '../types.js';

export interface AdminUserListQuery {
  page?: number;
  pageSize?: number;
  role?: 'customer' | 'seller' | 'support_agent' | 'administrator';
  status?: 'pending_verification' | 'active' | 'suspended' | 'deleted';
}

export interface AdminSellerListQuery {
  page?: number;
  pageSize?: number;
  status?: 'pending_review' | 'active' | 'suspended' | 'rejected' | 'closed';
}

export interface AdminOrderListQuery {
  page?: number;
  pageSize?: number;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  customerEmail?: string;
}

export interface AdminReturnListQuery {
  page?: number;
  pageSize?: number;
  status?: string;
}

export interface AdminProductListQuery {
  page?: number;
  pageSize?: number;
  moderationStatus?: 'draft' | 'pending_review' | 'published' | 'rejected' | 'archived';
  categoryId?: string;
  sellerId?: string;
}

export interface CreateCategoryPayload {
  name: string;
  slug: string;
  parentId?: string;
  description?: string;
}

export interface CreateBrandPayload {
  name: string;
  slug: string;
  description?: string;
}

export interface CreateCouponPayload {
  code: string;
  description?: string;
  discountType: 'percentage' | 'fixed_amount';
  percentageBasisPoints?: number;
  discountValue?: { amountMinor: number; currency: string };
  maxDiscount?: { amountMinor: number; currency: string };
  minOrderAmount?: { amountMinor: number; currency: string };
  currency: string;
  eligibleCategoryIds?: string[];
  eligibleProductIds?: string[];
  startsAt: string;
  expiresAt: string;
  usageLimit?: number;
  perUserLimit?: number;
}

export interface ProcessRefundPayload {
  paymentAttemptId: string;
  returnRequestId?: string;
  requestedAmount: { amountMinor: number; currency: string };
  reason?: string;
}

export function createAdminModule(client: ApiClient) {
  return {
    getAnalyticsOverview: (rangeDays = 30) =>
      client.request<AnalyticsOverviewDto>('GET', '/admin/analytics/overview', undefined, { query: { rangeDays } }),

    listUsers: (query: AdminUserListQuery = {}) =>
      client.requestWithMeta<UserDto[], { pagination: PaginationMeta }>('GET', '/admin/users', undefined, {
        query: query as Record<string, string | number | boolean | undefined>
      }),
    getUser: (userId: string) => client.request<UserDetailDto>('GET', `/admin/users/${userId}`),
    changeUserStatus: (userId: string, status: 'active' | 'suspended', note?: string) =>
      client.request<UserDto>('PATCH', `/admin/users/${userId}/status`, { status, note }),

    listSellers: (query: AdminSellerListQuery = {}) =>
      client.requestWithMeta<SellerDto[], { pagination: PaginationMeta }>('GET', '/admin/sellers', undefined, {
        query: query as Record<string, string | number | boolean | undefined>
      }),
    getSeller: (sellerId: string) => client.request<SellerDetailDto>('GET', `/admin/sellers/${sellerId}`),
    changeSellerStatus: (sellerId: string, status: 'active' | 'suspended' | 'rejected' | 'closed', note?: string) =>
      client.request<SellerDto>('PATCH', `/admin/sellers/${sellerId}/status`, { status, note }),

    createCategory: (payload: CreateCategoryPayload) => client.request<CategoryDto>('POST', '/admin/categories', payload),
    createBrand: (payload: CreateBrandPayload) => client.request<BrandDto>('POST', '/admin/brands', payload),

    listProducts: (query: AdminProductListQuery = {}) =>
      client.requestWithMeta<AdminProductDto[], { pagination: PaginationMeta }>('GET', '/admin/products', undefined, {
        query: query as Record<string, string | number | boolean | undefined>
      }),
    moderateProduct: (productId: string, status: 'published' | 'rejected' | 'archived', note?: string) =>
      client.request<AdminProductDto>('PATCH', `/admin/products/${productId}/moderate`, { status, note }),

    searchOrders: (query: AdminOrderListQuery = {}) =>
      client.requestWithMeta<OrderSummaryDto[], { pagination: PaginationMeta }>('GET', '/admin/orders', undefined, {
        query: query as Record<string, string | number | boolean | undefined>
      }),
    getOrder: (orderId: string) => client.request<OrderDetailDto>('GET', `/admin/orders/${orderId}`),
    listPaymentAttempts: (orderId: string) => client.request<PaymentAttemptDto[]>('GET', `/admin/orders/${orderId}/payment-attempts`),

    listReturns: (query: AdminReturnListQuery = {}) =>
      client.requestWithMeta<ReturnRequestDto[], { pagination: PaginationMeta }>('GET', '/admin/returns', undefined, {
        query: query as Record<string, string | number | boolean | undefined>
      }),
    reviewReturn: (returnId: string, decision: 'approved' | 'rejected', approvedAmount?: { amountMinor: number; currency: string }, note?: string) =>
      client.request<ReturnRequestDto>('PATCH', `/admin/returns/${returnId}/review`, { decision, approvedAmount, note }),

    processRefund: (payload: ProcessRefundPayload) =>
      client.request<{ id: string; status: string }>('POST', '/admin/refunds', payload),

    moderateReview: (reviewId: string, status: 'approved' | 'rejected', note?: string) =>
      client.request<ReviewDto>('PATCH', `/admin/reviews/${reviewId}/moderate`, { status, note }),

    listCoupons: (page = 1, pageSize = 20) =>
      client.requestWithMeta<CouponDto[], { pagination: PaginationMeta }>('GET', '/admin/coupons', undefined, {
        query: { page, pageSize }
      }),
    createCoupon: (payload: CreateCouponPayload) => client.request<CouponDto>('POST', '/admin/coupons', payload),

    listAuditLogs: (page = 1, pageSize = 20) =>
      client.requestWithMeta<AuditLogDto[], { pagination: PaginationMeta }>('GET', '/admin/audit-logs', undefined, {
        query: { page, pageSize }
      }),

    getAiOverview: () => client.request<AiAdminOverviewDto>('GET', '/admin/ai/overview'),
    listAiConversations: (page = 1, pageSize = 20) =>
      client.requestWithMeta<AiConversationSummaryDto[], { pagination: PaginationMeta }>('GET', '/admin/ai/conversations', undefined, {
        query: { page, pageSize }
      }),
    getAiConversation: (conversationId: string) =>
      client.request<AiConversationDetailDto>('GET', `/admin/ai/conversations/${conversationId}`)
  };
}
