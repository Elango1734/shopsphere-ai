import { Types } from 'mongoose';
import { OrderModel } from '../models/order.model.js';
import { CartModel } from '../models/cart.model.js';
import { InventoryModel } from '../models/inventory.model.js';
import { getFunnelForRange, type FunnelCounts } from './analyticsEvent.repository.js';

const CAPTURED_PAYMENT_STATUSES = ['paid', 'partially_refunded', 'refunded'] as const;

/** How far back sales velocity is measured when projecting days of cover. */
const VELOCITY_WINDOW_DAYS = 30;
/** A variant with fewer days of stock than this is reported as a stockout risk. */
const STOCK_RISK_DAYS = 7;
/** Carts touched within this window are "live" abandonments worth recovering; older ones are noise. */
const ABANDONED_CART_WINDOW_DAYS = 7;

export interface ComparedMetric {
  current: number;
  previous: number;
  /** null when the previous period was 0 — a percentage change from zero is undefined, not "+100%". */
  deltaPct: number | null;
}

export interface SellerDailyReportFacts {
  sellerId: string;
  /** UTC day the report covers, YYYY-MM-DD. */
  date: string;
  /** The day it is compared against (the preceding UTC day). */
  comparedTo: string;
  currency: string;
  revenueMinor: ComparedMetric;
  orderCount: ComparedMetric;
  unitsSold: ComparedMetric;
  averageOrderValueMinor: ComparedMetric;
  topProducts: Array<{ productId: string; name: string; unitsSold: number; revenueMinor: number }>;
  stockRisks: Array<{
    variantId: string;
    productName: string;
    sku: string;
    available: number;
    /** Units per day over the last `VELOCITY_WINDOW_DAYS`, to two decimals. */
    dailyVelocity: number;
    /** Whole days of stock left at that velocity. */
    daysOfCover: number;
  }>;
  slowMovers: Array<{ variantId: string; productName: string; sku: string; available: number }>;
  abandonedCarts: { count: number; valueMinor: number; topProductNames: string[] };
  pendingFulfillmentCount: number;
  /**
   * Storefront funnel for the same day, and the day before it for comparison.
   * `conversionRatePct` is null until the storefront is actually sending
   * events — an absent conversion rate is reported as absent, never as zero,
   * because "nobody converted" and "nothing was measured" are different facts.
   */
  funnel: FunnelCounts;
  previousFunnel: FunnelCounts;
}

function utcDayBounds(date: string): { start: Date; end: Date } {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Yesterday in UTC — the default window, since today is still accumulating. */
export function defaultReportDate(now = new Date()): string {
  return toDateString(new Date(now.getTime() - 24 * 60 * 60 * 1000));
}

function compare(current: number, previous: number): ComparedMetric {
  const deltaPct = previous === 0 ? null : Math.round(((current - previous) / previous) * 1000) / 10;
  return { current, previous, deltaPct };
}

/**
 * Seller-scoped totals for one UTC day. Revenue is summed from the seller's
 * own order *lines* (`items.lineTotal`), never the order's `grandTotal`,
 * which on a multi-seller order also contains other sellers' goods plus
 * platform-level shipping and tax.
 */
async function dayTotals(
  sellerId: Types.ObjectId,
  date: string
): Promise<{ revenueMinor: number; orderCount: number; unitsSold: number; currency?: string }> {
  const { start, end } = utcDayBounds(date);

  const [row] = await OrderModel.aggregate([
    {
      $match: {
        placedAt: { $gte: start, $lt: end },
        sellerIds: sellerId,
        paymentStatus: { $in: CAPTURED_PAYMENT_STATUSES }
      }
    },
    { $unwind: '$items' },
    { $match: { 'items.sellerId': sellerId } },
    {
      $group: {
        _id: '$items.lineTotal.currency',
        revenueMinor: { $sum: '$items.lineTotal.amountMinor' },
        unitsSold: { $sum: '$items.quantity' },
        orderIds: { $addToSet: '$_id' }
      }
    }
  ]);

  return {
    revenueMinor: row?.revenueMinor ?? 0,
    unitsSold: row?.unitsSold ?? 0,
    orderCount: row?.orderIds?.length ?? 0,
    currency: row?._id
  };
}

async function topProductsForDay(sellerId: Types.ObjectId, date: string, limit = 5) {
  const { start, end } = utcDayBounds(date);

  const rows = await OrderModel.aggregate([
    {
      $match: {
        placedAt: { $gte: start, $lt: end },
        sellerIds: sellerId,
        paymentStatus: { $in: CAPTURED_PAYMENT_STATUSES }
      }
    },
    { $unwind: '$items' },
    { $match: { 'items.sellerId': sellerId } },
    {
      $group: {
        _id: '$items.productId',
        // The order line snapshots the name at purchase time, which is what the merchant sold under.
        name: { $first: '$items.name' },
        unitsSold: { $sum: '$items.quantity' },
        revenueMinor: { $sum: '$items.lineTotal.amountMinor' }
      }
    },
    { $sort: { revenueMinor: -1 } },
    { $limit: limit }
  ]);

  return rows.map((r: { _id: Types.ObjectId; name: string; unitsSold: number; revenueMinor: number }) => ({
    productId: r._id.toString(),
    name: r.name,
    unitsSold: r.unitsSold,
    revenueMinor: r.revenueMinor
  }));
}

/**
 * Stock risk and slow movers come from the same pass: sales velocity over the
 * trailing window joined onto current inventory. A variant the merchant is
 * selling fast with little cover is a risk; one with stock and no sales at
 * all is dead weight. Both are arithmetic over real documents — no model is
 * asked to estimate demand.
 */
async function stockSignals(sellerId: Types.ObjectId, date: string) {
  const { end } = utcDayBounds(date);
  const windowStart = new Date(end.getTime() - VELOCITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const soldRows = await OrderModel.aggregate([
    {
      $match: {
        placedAt: { $gte: windowStart, $lt: end },
        sellerIds: sellerId,
        paymentStatus: { $in: CAPTURED_PAYMENT_STATUSES }
      }
    },
    { $unwind: '$items' },
    { $match: { 'items.sellerId': sellerId } },
    { $group: { _id: '$items.variantId', units: { $sum: '$items.quantity' }, name: { $first: '$items.name' }, sku: { $first: '$items.sku' } } }
  ]);

  const soldByVariant = new Map<string, { units: number; name: string; sku: string }>(
    soldRows.map((r: { _id: Types.ObjectId; units: number; name: string; sku: string }) => [
      r._id.toString(),
      { units: r.units, name: r.name, sku: r.sku }
    ])
  );

  const inventory = await InventoryModel.aggregate([
    { $match: { sellerId } },
    { $addFields: { available: { $subtract: ['$onHand', '$reserved'] } } },
    // Collection name is explicit on the model (`product_variants`), not Mongoose's default pluralisation.
    { $lookup: { from: 'product_variants', localField: 'variantId', foreignField: '_id', as: 'variant' } },
    { $unwind: { path: '$variant', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'products', localField: 'variant.productId', foreignField: '_id', as: 'product' } },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    { $project: { variantId: 1, available: 1, sku: '$variant.sku', productName: '$product.name' } }
  ]);

  const stockRisks: SellerDailyReportFacts['stockRisks'] = [];
  const slowMovers: SellerDailyReportFacts['slowMovers'] = [];

  for (const inv of inventory as Array<{ variantId: Types.ObjectId; available: number; sku?: string; productName?: string }>) {
    const key = inv.variantId.toString();
    const sold = soldByVariant.get(key);
    const productName = inv.productName ?? sold?.name ?? 'Unknown product';
    const sku = inv.sku ?? sold?.sku ?? '—';

    if (!sold || sold.units === 0) {
      if (inv.available > 0) slowMovers.push({ variantId: key, productName, sku, available: inv.available });
      continue;
    }

    const dailyVelocity = Math.round((sold.units / VELOCITY_WINDOW_DAYS) * 100) / 100;
    const daysOfCover = dailyVelocity > 0 ? Math.floor(inv.available / dailyVelocity) : Number.POSITIVE_INFINITY;
    if (daysOfCover <= STOCK_RISK_DAYS) {
      stockRisks.push({ variantId: key, productName, sku, available: inv.available, dailyVelocity, daysOfCover });
    }
  }

  stockRisks.sort((a, b) => a.daysOfCover - b.daysOfCover);
  slowMovers.sort((a, b) => b.available - a.available);

  return { stockRisks: stockRisks.slice(0, 10), slowMovers: slowMovers.slice(0, 10) };
}

/**
 * Carts holding this seller's items that were touched recently and never
 * became an order. `indicativeUnitPrice` is explicitly not authoritative
 * (checkout re-prices), so the value here is reported as indicative too.
 */
async function abandonedCarts(sellerId: Types.ObjectId, date: string) {
  const { end } = utcDayBounds(date);
  const windowStart = new Date(end.getTime() - ABANDONED_CART_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const rows = await CartModel.aggregate([
    { $match: { 'items.sellerId': sellerId, updatedAt: { $gte: windowStart, $lt: end } } },
    { $unwind: '$items' },
    { $match: { 'items.sellerId': sellerId } },
    {
      $lookup: { from: 'products', localField: 'items.productId', foreignField: '_id', as: 'product' }
    },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$_id',
        valueMinor: { $sum: { $multiply: ['$items.indicativeUnitPrice.amountMinor', '$items.quantity'] } },
        productNames: { $addToSet: '$product.name' }
      }
    }
  ]);

  const names = new Map<string, number>();
  for (const r of rows as Array<{ productNames: Array<string | null> }>) {
    for (const n of r.productNames) if (n) names.set(n, (names.get(n) ?? 0) + 1);
  }

  return {
    count: rows.length,
    valueMinor: rows.reduce((sum: number, r: { valueMinor: number }) => sum + r.valueMinor, 0),
    topProductNames: [...names.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name)
  };
}

/**
 * Every figure in the daily report, computed from MongoDB before any model is
 * involved. The AI layer narrates this object and may not add to it — see
 * `llmProvider.ts`'s grounding contract.
 */
export async function getSellerDailyReportFacts(sellerIdRaw: string, date: string): Promise<SellerDailyReportFacts> {
  const sellerId = new Types.ObjectId(sellerIdRaw);
  const { start } = utcDayBounds(date);
  const comparedTo = toDateString(new Date(start.getTime() - 24 * 60 * 60 * 1000));

  const priorBounds = utcDayBounds(comparedTo);
  const bounds = utcDayBounds(date);

  const [today, yesterday, topProducts, signals, carts, pendingFulfillmentCount, funnel, previousFunnel] = await Promise.all([
    dayTotals(sellerId, date),
    dayTotals(sellerId, comparedTo),
    topProductsForDay(sellerId, date),
    stockSignals(sellerId, date),
    abandonedCarts(sellerId, date),
    OrderModel.countDocuments({ sellerIds: sellerId, fulfillmentStatus: { $in: ['pending', 'confirmed'] } }),
    getFunnelForRange(bounds.start, bounds.end, sellerIdRaw),
    getFunnelForRange(priorBounds.start, priorBounds.end, sellerIdRaw)
  ]);

  const aov = (t: { revenueMinor: number; orderCount: number }) => (t.orderCount === 0 ? 0 : Math.round(t.revenueMinor / t.orderCount));

  return {
    sellerId: sellerIdRaw,
    date,
    comparedTo,
    currency: today.currency ?? yesterday.currency ?? 'USD',
    revenueMinor: compare(today.revenueMinor, yesterday.revenueMinor),
    orderCount: compare(today.orderCount, yesterday.orderCount),
    unitsSold: compare(today.unitsSold, yesterday.unitsSold),
    averageOrderValueMinor: compare(aov(today), aov(yesterday)),
    topProducts,
    stockRisks: signals.stockRisks,
    slowMovers: signals.slowMovers,
    abandonedCarts: carts,
    pendingFulfillmentCount,
    funnel,
    previousFunnel
  };
}
