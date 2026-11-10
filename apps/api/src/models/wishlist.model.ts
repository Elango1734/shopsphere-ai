import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const MAX_WISHLIST_ITEMS = 500;

const wishlistItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, ref: 'ProductVariant' },
    addedAt: { type: Date, required: true, default: () => new Date() }
  },
  { _id: false }
);

/**
 * One wishlist document per customer with a bounded, deduplicated item array.
 * Deduplication (same productId+variantId not added twice) and the size cap
 * are enforced in the repository's `$addToSet`-based update, not just here,
 * since Mongoose array validators run on the whole array only on full saves.
 */
const wishlistSchema = new Schema(
  {
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: {
      type: [wishlistItemSchema],
      default: [],
      validate: {
        validator: (arr: unknown[]) => arr.length <= MAX_WISHLIST_ITEMS,
        message: `A wishlist may have at most ${MAX_WISHLIST_ITEMS} items`
      }
    }
  },
  { timestamps: true }
);

wishlistSchema.index({ ownerUserId: 1 }, { unique: true });

export type WishlistDocument = HydratedDocument<InferSchemaType<typeof wishlistSchema>>;
export const WishlistModel = model('Wishlist', wishlistSchema, 'wishlists');
