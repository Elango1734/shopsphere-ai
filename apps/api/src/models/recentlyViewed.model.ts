import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const RECENTLY_VIEWED_MAX_ITEMS = 50;

const recentlyViewedItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    viewedAt: { type: Date, required: true, default: () => new Date() }
  },
  { _id: false }
);

/**
 * One document per customer (or guest token) holding a capped-recency array —
 * the "appropriate alternative" to a RecentlyViewedItem-per-view collection,
 * which would grow unbounded. The repository maintains the cap with
 * `$push` + `$slice: -50` on every view event, not full-document validation,
 * so this schema's array validator is a defensive backstop, not the
 * enforcement mechanism.
 */
const recentlyViewedSchema = new Schema(
  {
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    guestTokenHash: { type: String, trim: true },
    items: {
      type: [recentlyViewedItemSchema],
      default: [],
      validate: {
        validator: (arr: unknown[]) => arr.length <= RECENTLY_VIEWED_MAX_ITEMS,
        message: `Recently viewed is capped at ${RECENTLY_VIEWED_MAX_ITEMS} items`
      }
    },
    expiresAt: { type: Date }
  },
  { timestamps: true }
);

recentlyViewedSchema.pre('validate', function (next) {
  const hasOwner = Boolean(this.ownerUserId);
  const hasGuestToken = Boolean(this.guestTokenHash);
  if (hasOwner === hasGuestToken) {
    this.invalidate('ownerUserId', 'Must have exactly one of ownerUserId or guestTokenHash');
  }
  next();
});

recentlyViewedSchema.index({ ownerUserId: 1 }, { unique: true, sparse: true });
recentlyViewedSchema.index({ guestTokenHash: 1 }, { unique: true, sparse: true });
recentlyViewedSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RecentlyViewedDocument = HydratedDocument<InferSchemaType<typeof recentlyViewedSchema>>;
export const RecentlyViewedModel = model('RecentlyViewed', recentlyViewedSchema, 'recently_viewed');
