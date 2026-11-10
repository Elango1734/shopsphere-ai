import type { Money, PaginationMeta } from '@shopsphere/shared-types';

export type { PaginationMeta };

export interface UserDto {
  id: string;
  email?: string;
  phone?: string;
  roles: string[];
  status: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  displayName?: string;
  preferredCurrency?: string;
  createdAt: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
}

export interface AddressFields {
  recipientName: string;
  addressLine1: string;
  addressLine2?: string;
  locality: string;
  region?: string;
  postalCode: string;
  countryCode: string;
  phone?: string;
}

export interface AddressDto {
  id: string;
  label: 'home' | 'work' | 'other';
  isDefault: boolean;
  fields: AddressFields;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  description?: string;
}

export interface BrandDto {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface ProductImageDto {
  storageKey: string;
  altText?: string;
}

export interface PriceRangeDto {
  minAmountMinor: number;
  maxAmountMinor: number;
  currency: string;
}

export interface ProductSummaryDto {
  id: string;
  name: string;
  slug: string;
  sellerId: string;
  categoryId: string;
  brandId: string | null;
  images: ProductImageDto[];
  priceRange: PriceRangeDto | null;
  ratingAverage: number;
  ratingCount: number;
  hasAvailableStock: boolean;
}

export interface VariantDto {
  id: string;
  sku: string;
  attributes: Record<string, string>;
  price: Money;
  regularPrice: Money;
  salePrice: Money | null;
  status: string;
  availableQuantity: number;
}

export interface ProductDetailDto extends ProductSummaryDto {
  description?: string;
  attributes: Array<{ name: string; value: string }>;
  returnPolicyRef?: string;
  warrantyPolicyRef?: string;
  variants: VariantDto[];
}

export interface ReviewDto {
  id: string;
  productId: string;
  customerId: string;
  rating: number;
  title?: string;
  body?: string;
  moderationStatus: string;
  isVerifiedPurchase: boolean;
  isDemoData?: boolean;
  createdAt: string;
}

export interface QuestionAnswerDto {
  id: string;
  answeredBy: string;
  isSellerAnswer: boolean;
  body: string;
  answeredAt: string;
}

export interface QuestionDto {
  id: string;
  productId: string;
  askedBy: string;
  body: string;
  answers: QuestionAnswerDto[];
  createdAt: string;
}

export interface CartItemDto {
  variantId: string;
  productId: string;
  sellerId: string;
  quantity: number;
  indicativeUnitPrice: Money;
  addedAt: string;
}

export interface CartDto {
  id: string;
  currency: string;
  items: CartItemDto[];
  updatedAt: string;
}

export interface CheckoutResultDto {
  orderId: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  grandTotal: Money;
  paymentAttemptId: string;
}

export interface OrderSummaryDto {
  id: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  grandTotal: Money;
  itemCount: number;
  placedAt: string;
}

export interface OrderItemDto {
  productId: string;
  variantId: string;
  sellerId: string;
  name: string;
  sku: string;
  attributes: Record<string, string>;
  unitPrice: Money;
  discount: Money;
  taxAmount: Money;
  quantity: number;
  lineTotal: Money;
}

export interface OrderStatusHistoryEntryDto {
  track: 'payment' | 'fulfillment';
  status: string;
  changedAt: string;
  note?: string;
}

export interface OrderDetailDto extends OrderSummaryDto {
  items: OrderItemDto[];
  itemSubtotal: Money;
  discountTotal: Money;
  taxTotal: Money;
  shippingTotal: Money;
  shippingAddress: AddressFields;
  statusHistory: OrderStatusHistoryEntryDto[];
  cancelledAt: string | null;
  cancelReason: string | null;
}

export interface ShipmentTrackingEventDto {
  status: string;
  description?: string;
  location?: string;
  occurredAt: string;
}

export interface ShipmentDto {
  id: string;
  orderId: string;
  sellerId: string;
  carrier?: string;
  trackingNumber?: string;
  status: string;
  trackingEvents: ShipmentTrackingEventDto[];
  shippedAt: string | null;
  deliveredAt: string | null;
}

export interface ReturnRequestDto {
  id: string;
  orderId: string;
  status: string;
  items: Array<{ variantId: string; quantity: number; reason?: string }>;
  requestedAmount: Money;
  approvedAmount: Money | null;
  reason?: string;
  statusHistory: Array<{ status: string; changedAt: string; note?: string }>;
  createdAt: string;
}

export interface WishlistItemDto {
  productId: string;
  variantId: string | null;
  addedAt: string;
  product: ProductSummaryDto | null;
}

export interface RecentlyViewedItemDto {
  productId: string;
  viewedAt: string;
  product: ProductSummaryDto | null;
}

export interface NotificationDto {
  id: string;
  type: string;
  channel: string;
  title: string;
  body?: string;
  data?: unknown;
  readAt: string | null;
  createdAt: string;
}

export interface SupportTicketDto {
  id: string;
  customerId: string;
  orderId: string | null;
  category: string;
  subject: string;
  status: string;
  assignedAgentId: string | null;
  lastMessageAt: string | null;
  createdAt: string;
}

export interface SupportMessageDto {
  id: string;
  ticketId: string;
  authorId: string;
  visibility: 'customer_visible' | 'internal_note';
  body: string;
  createdAt: string;
}

export interface AiReplyDto {
  conversationId: string;
  reply: string;
  products?: ProductSummaryDto[];
}

export interface ReviewSummaryDto {
  productId: string;
  reviewCount: number;
  ratingAverage: number;
  ratingDistribution: number[];
  summary: string;
}

export interface AiMessageDto {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  groundedProductIds: string[];
  createdAt: string;
}

export interface SellerDto {
  id: string;
  storeName: string;
  slug: string;
  status: string;
  description?: string;
  supportEmail?: string;
  createdAt: string;
}

export interface SellerDetailDto extends SellerDto {
  productCount: number;
  orderCount: number;
}

export interface UserDetailDto extends UserDto {
  orderCount: number;
}

export interface SellerProductDto {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  brandId: string | null;
  moderationStatus: string;
  moderationNote?: string;
  hasAvailableStock: boolean;
  createdAt: string;
}

export interface SellerVariantInventoryDto {
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
}

export interface SellerVariantDto {
  id: string;
  productId: string;
  sku: string;
  attributes: Record<string, string>;
  regularPrice: Money;
  salePrice: Money | null;
  status: string;
  inventory: SellerVariantInventoryDto | null;
}

export interface LowStockItemDto {
  variantId: string;
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
}

export interface CouponDto {
  id: string;
  code: string;
  description?: string;
  discountType: 'percentage' | 'fixed_amount';
  percentageBasisPoints?: number;
  discountValue?: Money;
  maxDiscount?: Money;
  minOrderAmount?: Money;
  currency: string;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
  usageLimit?: number;
  usedCount: number;
  perUserLimit: number;
}

export interface AuditLogDto {
  id: string;
  actorUserId: string | null;
  actorRole?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  requestId: string;
  beforeSummary?: unknown;
  afterSummary?: unknown;
  createdAt: string;
}

export interface AnalyticsRecentOrderDto {
  id: string;
  customerId: string;
  grandTotal: Money;
  paymentStatus: string;
  fulfillmentStatus: string;
  placedAt: string;
}

export interface AnalyticsCategoryPerformanceDto {
  categoryId: string;
  categoryName: string;
  orderCount: number;
  revenueMinor: number;
}

export interface AnalyticsOverviewDto {
  rangeDays: number;
  rangeStart: string;
  rangeEnd: string;
  currency: string;
  totalOrders: number;
  grossSalesMinor: number;
  refundsTotalMinor: number;
  netRevenueMinor: number;
  ordersByPaymentStatus: Record<string, number>;
  ordersByFulfillmentStatus: Record<string, number>;
  activeCustomersInRange: number;
  activeSellers: number;
  productsAwaitingModeration: number;
  lowStockVariantCount: number;
  pendingReturnsCount: number;
  recentOrders: AnalyticsRecentOrderDto[];
  categoryPerformance: AnalyticsCategoryPerformanceDto[];
}

export interface SellerAnalyticsOverviewDto {
  rangeDays: number;
  rangeStart: string;
  rangeEnd: string;
  currency: string;
  orderCount: number;
  revenueMinor: number;
  ordersByFulfillmentStatus: Record<string, number>;
  lowStockVariantCount: number;
  pendingOrdersCount: number;
}

/** Carries `moderationStatus`/`moderationNote`/`sellerId` — fields the customer-facing `ProductSummaryDto` never exposes — for the admin moderation queue. */
export interface AdminProductDto {
  id: string;
  name: string;
  slug: string;
  sellerId: string;
  categoryId: string;
  brandId: string | null;
  moderationStatus: string;
  moderationNote?: string;
  hasAvailableStock: boolean;
  createdAt: string;
}

export interface PaymentAttemptDto {
  id: string;
  orderId: string;
  provider: string;
  providerPaymentRef?: string;
  amount: Money;
  status: 'pending' | 'authorized' | 'succeeded' | 'failed' | 'cancelled';
  paymentMethodDisplay?: string;
  failureReason?: string;
  confirmedAt: string | null;
  createdAt: string;
}

export interface AiAdminOverviewDto {
  provider: string;
  model: string | null;
  apiKeyConfigured: boolean;
  totalConversations: number;
  activeConversations: number;
  totalMessages: number;
  conversationsByPurpose: Record<string, number>;
}

export interface AiConversationSummaryDto {
  id: string;
  ownerType: 'user' | 'guest';
  ownerUserId: string | null;
  purpose: string;
  messageCount: number;
  lastMessageAt: string | null;
  retainUntil: string;
  deletedAt: string | null;
  createdAt: string;
}

/** Admin drill-in messages carry an `id` (for list keys/moderation) that the customer-facing history endpoint does not. */
export interface AdminAiMessageDto extends AiMessageDto {
  id: string;
}

export interface AiConversationDetailDto extends AiConversationSummaryDto {
  messages: AdminAiMessageDto[];
}
