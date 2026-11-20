import { Types } from 'mongoose';
import { AnalyticsEventModel, type AnalyticsEventType } from '../models/analyticsEvent.model.js';
import { ProductModel } from '../models/product.model.js';

export interface IncomingEvent {
  type: AnalyticsEventType;
  sessionId: string;
  productId?: string;
  categoryId?: string;
  resultCount?: number;
  occurredAt?: string;
}

export interface EventOwner {
  userId?: string;
  guestTokenHash?: string;
}

/**
 * Clients never supply `sellerId`: it is resolved here from the product they
 * named, so a client cannot attribute traffic to a seller it has nothing to
 * do with. Events whose product does not exist are still recorded, just
 * without a seller — dropping them would silently lose funnel steps whenever
 * a product is archived mid-session.
 */
export async function recordEvents(owner: EventOwner, events: IncomingEvent[]): Promise<number> {
  const productIds = [...new Set(events.map((e) => e.productId).filter((id): id is string => Boolean(id)))];

  const sellerByProduct = new Map<string, Types.ObjectId>();
  if (productIds.length > 0) {
    const products = await ProductModel.find({ _id: { $in: productIds.map((id) => new Types.ObjectId(id)) } }).select('sellerId');
    for (const p of products) sellerByProduct.set(p._id.toString(), p.sellerId);
  }

  // A client clock can be wrong or hostile; an event is never accepted as being from the future.
  const now = Date.now();
  const docs = events.map((e) => {
    const claimed = e.occurredAt ? Date.parse(e.occurredAt) : now;
    const occurredAt = new Date(Number.isNaN(claimed) ? now : Math.min(claimed, now));

    return {
      type: e.type,
      sessionId: e.sessionId,
      ...(owner.userId ? { userId: new Types.ObjectId(owner.userId) } : {}),
      ...(owner.guestTokenHash ? { guestTokenHash: owner.guestTokenHash } : {}),
      ...(e.productId ? { productId: new Types.ObjectId(e.productId) } : {}),
      ...(e.categoryId ? { categoryId: new Types.ObjectId(e.categoryId) } : {}),
      ...(e.productId && sellerByProduct.has(e.productId) ? { sellerId: sellerByProduct.get(e.productId) } : {}),
      ...(e.resultCount != null ? { resultCount: e.resultCount } : {}),
      occurredAt
    };
  });

  const inserted = await AnalyticsEventModel.insertMany(docs, { ordered: false });
  return inserted.length;
}

export interface FunnelCounts {
  /** Distinct sessions that produced any event in the window. */
  sessions: number;
  productViews: number;
  addToCarts: number;
  checkoutStarts: number;
  ordersPlaced: number;
  /** Sessions that reached `order_placed`, over sessions that produced any event, as a percentage to one decimal. */
  conversionRatePct: number | null;
  /** Sessions that added to cart but never reached `order_placed`, over sessions that added to cart. */
  cartAbandonmentRatePct: number | null;
}

/**
 * Conversion is counted per SESSION, not per event: a shopper who views six
 * products and buys once is one converted session, and counting events would
 * make conversion fall as engagement rises. Sessions are the denominator
 * everywhere in this function for the same reason.
 */
export async function getFunnelForRange(
  start: Date,
  end: Date,
  sellerId?: string
): Promise<FunnelCounts> {
  const match: Record<string, unknown> = { occurredAt: { $gte: start, $lt: end } };
  if (sellerId) match.sellerId = new Types.ObjectId(sellerId);

  const [row] = await AnalyticsEventModel.aggregate([
    { $match: match },
    {
      $facet: {
        sessions: [{ $group: { _id: '$sessionId' } }, { $count: 'count' }],
        byType: [{ $group: { _id: '$type', count: { $sum: 1 } } }],
        convertedSessions: [{ $match: { type: 'order_placed' } }, { $group: { _id: '$sessionId' } }, { $count: 'count' }],
        cartSessions: [{ $match: { type: 'add_to_cart' } }, { $group: { _id: '$sessionId' } }, { $count: 'count' }],
        cartThenOrder: [
          { $match: { type: { $in: ['add_to_cart', 'order_placed'] } } },
          { $group: { _id: '$sessionId', types: { $addToSet: '$type' } } },
          { $match: { types: { $all: ['add_to_cart', 'order_placed'] } } },
          { $count: 'count' }
        ]
      }
    }
  ]);

  const counts: Record<string, number> = {};
  for (const r of row?.byType ?? []) counts[r._id] = r.count;

  const sessions: number = row?.sessions?.[0]?.count ?? 0;
  const converted: number = row?.convertedSessions?.[0]?.count ?? 0;
  const cartSessions: number = row?.cartSessions?.[0]?.count ?? 0;
  const cartThenOrder: number = row?.cartThenOrder?.[0]?.count ?? 0;

  const pct = (numerator: number, denominator: number) =>
    denominator === 0 ? null : Math.round((numerator / denominator) * 1000) / 10;

  return {
    sessions,
    productViews: counts.product_view ?? 0,
    addToCarts: counts.add_to_cart ?? 0,
    checkoutStarts: counts.checkout_start ?? 0,
    ordersPlaced: counts.order_placed ?? 0,
    conversionRatePct: pct(converted, sessions),
    cartAbandonmentRatePct: pct(cartSessions - cartThenOrder, cartSessions)
  };
}
