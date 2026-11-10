import { Types } from 'mongoose';
import { OrderModel } from '../models/order.model.js';
import { RefundModel } from '../models/refund.model.js';
import { SellerModel } from '../models/seller.model.js';
import { ProductModel } from '../models/product.model.js';
import { InventoryModel } from '../models/inventory.model.js';
import { ReturnRequestModel } from '../models/returnRequest.model.js';
import { CategoryModel } from '../models/category.model.js';
import { UserModel } from '../models/user.model.js';

const CAPTURED_PAYMENT_STATUSES = ['paid', 'partially_refunded', 'refunded'] as const;

export interface AnalyticsOverview {
  rangeDays: number;
  rangeStart: string;
  rangeEnd: string;
  currency: string;
  /** Orders whose payment was captured at least once in the range (paid/partially_refunded/refunded). */
  totalOrders: number;
  /** Sum of `grandTotal` for those orders — the post-discount, pre-refund amount actually charged. */
  grossSalesMinor: number;
  /** Sum of succeeded refunds approved in the range (by `updatedAt`, the closest proxy to "when it settled"). */
  refundsTotalMinor: number;
  /** grossSalesMinor - refundsTotalMinor. Does NOT subtract seller commission or payment processor fees. */
  netRevenueMinor: number;
  ordersByPaymentStatus: Record<string, number>;
  ordersByFulfillmentStatus: Record<string, number>;
  /** Distinct customers who placed an order in the range — not a count of all registered customers. */
  activeCustomersInRange: number;
  /** Snapshot, not range-bound: sellers currently in `active` status. */
  activeSellers: number;
  /** Snapshot: products currently awaiting moderation. */
  productsAwaitingModeration: number;
  /** Snapshot: variants whose available quantity (onHand - reserved) is at or below their configured threshold. */
  lowStockVariantCount: number;
  /** Snapshot: return requests still in `requested` status. */
  pendingReturnsCount: number;
  recentOrders: Array<{
    id: string;
    customerId: string;
    grandTotal: { amountMinor: number; currency: string };
    paymentStatus: string;
    fulfillmentStatus: string;
    placedAt: string;
  }>;
  categoryPerformance: Array<{ categoryId: string; categoryName: string; orderCount: number; revenueMinor: number }>;
}

/**
 * Every number here comes from a real MongoDB aggregation over the actual
 * collections — never computed from whatever page of a table happens to be
 * loaded client-side (api-specification.md's admin dashboard requirement).
 * `currency` assumes a single-currency deployment (true of this seed data);
 * a genuinely multi-currency platform would need to bucket every sum by
 * currency instead of picking one, which is out of scope for this stage.
 */
export async function getAnalyticsOverview(rangeDays: number): Promise<AnalyticsOverview> {
  const rangeEnd = new Date();
  const rangeStart = new Date(rangeEnd.getTime() - rangeDays * 24 * 60 * 60 * 1000);

  const [facetResult] = await OrderModel.aggregate([
    { $match: { placedAt: { $gte: rangeStart, $lte: rangeEnd } } },
    {
      $facet: {
        captured: [
          { $match: { paymentStatus: { $in: CAPTURED_PAYMENT_STATUSES } } },
          { $group: { _id: '$grandTotal.currency', totalOrders: { $sum: 1 }, grossSalesMinor: { $sum: '$grandTotal.amountMinor' } } }
        ],
        byPaymentStatus: [{ $group: { _id: '$paymentStatus', count: { $sum: 1 } } }],
        byFulfillmentStatus: [{ $group: { _id: '$fulfillmentStatus', count: { $sum: 1 } } }],
        distinctCustomers: [{ $group: { _id: '$customerId' } }, { $count: 'count' }],
        recent: [
          { $sort: { placedAt: -1 } },
          { $limit: 10 },
          { $project: { _id: 1, customerId: 1, grandTotal: 1, paymentStatus: 1, fulfillmentStatus: 1, placedAt: 1 } }
        ],
        categoryPerf: [
          { $unwind: '$items' },
          { $lookup: { from: 'products', localField: 'items.productId', foreignField: '_id', as: 'product' } },
          { $unwind: '$product' },
          { $group: { _id: '$product.categoryId', orderCount: { $sum: 1 }, revenueMinor: { $sum: '$items.lineTotal.amountMinor' } } },
          { $sort: { revenueMinor: -1 } },
          { $limit: 5 }
        ]
      }
    }
  ]);

  const captured = facetResult?.captured?.[0] as { _id: string; totalOrders: number; grossSalesMinor: number } | undefined;
  const currency = captured?._id ?? 'USD';

  const [refundAgg] = await RefundModel.aggregate([
    { $match: { status: 'succeeded', updatedAt: { $gte: rangeStart, $lte: rangeEnd } } },
    { $group: { _id: '$approvedAmount.currency', total: { $sum: '$approvedAmount.amountMinor' } } }
  ]);
  const refundsTotalMinor: number = refundAgg?.total ?? 0;

  const categoryIds: Types.ObjectId[] = (facetResult?.categoryPerf ?? []).map((c: { _id: Types.ObjectId }) => c._id);
  const categories = await CategoryModel.find({ _id: { $in: categoryIds } }).select('name');
  const categoryNameById = new Map(categories.map((c) => [c._id.toString(), c.name]));

  const [activeSellers, productsAwaitingModeration, lowStockVariantCount, pendingReturnsCount] = await Promise.all([
    SellerModel.countDocuments({ status: 'active' }),
    ProductModel.countDocuments({ moderationStatus: 'pending_review' }),
    InventoryModel.countDocuments({ $expr: { $lte: [{ $subtract: ['$onHand', '$reserved'] }, '$lowStockThreshold'] } }),
    ReturnRequestModel.countDocuments({ status: 'requested' })
  ]);

  const ordersByPaymentStatus: Record<string, number> = {};
  for (const row of facetResult?.byPaymentStatus ?? []) ordersByPaymentStatus[row._id] = row.count;

  const ordersByFulfillmentStatus: Record<string, number> = {};
  for (const row of facetResult?.byFulfillmentStatus ?? []) ordersByFulfillmentStatus[row._id] = row.count;

  return {
    rangeDays,
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    currency,
    totalOrders: captured?.totalOrders ?? 0,
    grossSalesMinor: captured?.grossSalesMinor ?? 0,
    refundsTotalMinor,
    netRevenueMinor: (captured?.grossSalesMinor ?? 0) - refundsTotalMinor,
    ordersByPaymentStatus,
    ordersByFulfillmentStatus,
    activeCustomersInRange: facetResult?.distinctCustomers?.[0]?.count ?? 0,
    activeSellers,
    productsAwaitingModeration,
    lowStockVariantCount,
    pendingReturnsCount,
    recentOrders: (facetResult?.recent ?? []).map((o: { _id: Types.ObjectId; customerId: Types.ObjectId; grandTotal: { amountMinor: number; currency: string }; paymentStatus: string; fulfillmentStatus: string; placedAt: Date }) => ({
      id: o._id.toString(),
      customerId: o.customerId.toString(),
      grandTotal: o.grandTotal,
      paymentStatus: o.paymentStatus,
      fulfillmentStatus: o.fulfillmentStatus,
      placedAt: o.placedAt.toISOString()
    })),
    categoryPerformance: (facetResult?.categoryPerf ?? []).map((c: { _id: Types.ObjectId; orderCount: number; revenueMinor: number }) => ({
      categoryId: c._id.toString(),
      categoryName: categoryNameById.get(c._id.toString()) ?? 'Unknown',
      orderCount: c.orderCount,
      revenueMinor: c.revenueMinor
    }))
  };
}

/** Also used by the seller dashboard's own scoped overview — same shape of reasoning, filtered to one seller. */
export async function getSellerAnalyticsOverview(sellerId: string, rangeDays: number) {
  const rangeEnd = new Date();
  const rangeStart = new Date(rangeEnd.getTime() - rangeDays * 24 * 60 * 60 * 1000);
  const sellerObjectId = new Types.ObjectId(sellerId);

  const [facetResult] = await OrderModel.aggregate([
    { $match: { placedAt: { $gte: rangeStart, $lte: rangeEnd }, sellerIds: sellerObjectId } },
    {
      $facet: {
        captured: [
          { $match: { paymentStatus: { $in: CAPTURED_PAYMENT_STATUSES } } },
          { $unwind: '$items' },
          { $match: { 'items.sellerId': sellerObjectId } },
          { $group: { _id: '$items.lineTotal.currency', orderCount: { $addToSet: '$_id' }, revenueMinor: { $sum: '$items.lineTotal.amountMinor' } } }
        ],
        byFulfillmentStatus: [{ $group: { _id: '$fulfillmentStatus', count: { $sum: 1 } } }]
      }
    }
  ]);

  const captured = facetResult?.captured?.[0] as { _id: string; orderCount: unknown[]; revenueMinor: number } | undefined;
  const [lowStockVariantCount, pendingOrdersCount] = await Promise.all([
    InventoryModel.countDocuments({ sellerId: sellerObjectId, $expr: { $lte: [{ $subtract: ['$onHand', '$reserved'] }, '$lowStockThreshold'] } }),
    OrderModel.countDocuments({ sellerIds: sellerObjectId, fulfillmentStatus: { $in: ['pending', 'confirmed'] } })
  ]);

  const ordersByFulfillmentStatus: Record<string, number> = {};
  for (const row of facetResult?.byFulfillmentStatus ?? []) ordersByFulfillmentStatus[row._id] = row.count;

  return {
    rangeDays,
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    currency: captured?._id ?? 'USD',
    orderCount: captured?.orderCount.length ?? 0,
    revenueMinor: captured?.revenueMinor ?? 0,
    ordersByFulfillmentStatus,
    lowStockVariantCount,
    pendingOrdersCount
  };
}

export async function countActiveUsers(): Promise<number> {
  return UserModel.countDocuments({ status: 'active' });
}
