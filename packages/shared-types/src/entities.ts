export type UserRole = 'customer' | 'seller' | 'support_agent' | 'administrator';

export interface Money {
  amountMinor: number;
  currency: string;
}

export interface Address {
  recipientName: string;
  addressLine1: string;
  addressLine2?: string;
  locality: string;
  region?: string;
  postalCode: string;
  countryCode: string;
  phone?: string;
}

export interface ProductSnapshot {
  productId: string;
  variantId: string;
  sellerId: string;
  name: string;
  sku: string;
  attributes: Record<string, string>;
  unitPrice: Money;
  discount: Money;
  quantity: number;
}

export type PaymentStatus =
  | 'pending'
  | 'authorized'
  | 'paid'
  | 'failed'
  | 'partially_refunded'
  | 'refunded'
  | 'cancelled';

export type FulfillmentStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'partially_shipped'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'return_requested'
  | 'returned';

export type InventoryReservationStatus = 'active' | 'committed' | 'released' | 'expired';

export type ReturnStatus =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'in_transit'
  | 'received'
  | 'refunded'
  | 'closed';

export type RefundStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled';

export type SellerStatus = 'pending_review' | 'active' | 'suspended' | 'rejected' | 'closed';