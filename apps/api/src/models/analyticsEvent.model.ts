import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * The storefront behaviours worth counting. Deliberately a closed set: an
 * open-ended `type` string would make every funnel query a guess about what
 * clients happen to be sending, and the funnel below depends on these names
 * meaning exactly one thing each.
 */
export const ANALYTICS_EVENT_TYPES = [
  'session_start',
  'product_view',
  'search',
  'add_to_cart',
  'checkout_start',
  'order_placed'
] as const;
export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

/** Events age out after 13 months — long enough for a year-over-year comparison, bounded so the collection cannot grow without limit. */
const RETENTION_DAYS = 400;

/**
 * One storefront event. This collection exists because conversion rate,
 * funnel drop-off and traffic trends are not derivable from orders alone:
 * an order says what was bought, never how many people looked and left.
 *
 * Identity here is deliberately thin. A `sessionId` is an opaque
 * client-generated string used only to group one visit's events; a signed-in
 * shopper's `userId` is stored so their funnel can be attributed, and a guest
 * is stored as the SHA-256 `guestTokenHash` already used by carts — never the
 * raw token, and never anything derived from a customer identity (see
 * guestToken.ts). No IP address, user agent, or free-text payload is kept:
 * nothing here should be able to re-identify a shopper who deleted their
 * account.
 */
const analyticsEventSchema = new Schema(
  {
    type: { type: String, enum: ANALYTICS_EVENT_TYPES, required: true },
    /** Opaque per-visit grouping key. Not an identity, and never joined to anything outside this collection. */
    sessionId: { type: String, required: true, trim: true, maxlength: 64 },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    guestTokenHash: { type: String, trim: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    /** Denormalised so seller-scoped funnels do not need a lookup per event on the hot path. */
    sellerId: { type: Schema.Types.ObjectId, ref: 'Seller' },
    /** Only ever a coarse bucket, never the shopper's query text — search terms are free text and can carry anything. */
    resultCount: { type: Number, min: 0 },
    occurredAt: { type: Date, required: true, default: () => new Date() },
    expireAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000)
    }
  },
  { timestamps: true }
);

// The funnel aggregation always filters by day and groups by type, in that order.
analyticsEventSchema.index({ occurredAt: -1, type: 1 });
analyticsEventSchema.index({ sellerId: 1, occurredAt: -1 });
analyticsEventSchema.index({ sessionId: 1, occurredAt: 1 });
analyticsEventSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export type AnalyticsEventDocument = HydratedDocument<InferSchemaType<typeof analyticsEventSchema>>;
export const AnalyticsEventModel = model('AnalyticsEvent', analyticsEventSchema, 'analytics_events');
