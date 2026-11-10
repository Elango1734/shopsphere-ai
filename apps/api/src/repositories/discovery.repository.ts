import { Types } from 'mongoose';
import { WishlistModel, type WishlistDocument } from '../models/wishlist.model.js';
import { RecentlyViewedModel, RECENTLY_VIEWED_MAX_ITEMS } from '../models/recentlyViewed.model.js';

/**
 * Atomic toggle: first attempt a `$pull` of a matching item; if that actually
 * removed something (`modifiedCount > 0`) the call is a removal. Otherwise no
 * matching item existed, so fall through to an upsert `$addToSet`. Both steps
 * are plain `updateOne` calls (no read-modify-write of the array in
 * application code), so concurrent toggles from the same user converge
 * correctly instead of racing on a stale in-memory copy.
 */
export async function toggleWishlistItem(
  userId: string,
  productId: string,
  variantId?: string
): Promise<'added' | 'removed'> {
  const match = { productId: new Types.ObjectId(productId), ...(variantId ? { variantId: new Types.ObjectId(variantId) } : {}) };

  const pullResult = await WishlistModel.updateOne({ ownerUserId: userId }, { $pull: { items: match } });
  if (pullResult.modifiedCount > 0) {
    return 'removed';
  }

  await WishlistModel.updateOne(
    { ownerUserId: userId },
    {
      $setOnInsert: { ownerUserId: new Types.ObjectId(userId) },
      $addToSet: { items: { ...match, addedAt: new Date() } }
    },
    { upsert: true }
  );
  return 'added';
}

export async function getWishlist(userId: string): Promise<WishlistDocument | null> {
  return WishlistModel.findOne({ ownerUserId: userId });
}

/**
 * Bounded recency list maintained with `$push` + `$slice: -N`, which keeps
 * only the most recent N entries directly in MongoDB without ever reading
 * the array back into the application — the pattern the recentlyViewed
 * schema's doc comment describes.
 */
export async function recordProductView(
  ownerKey: { userId?: string; guestTokenHash?: string },
  productId: string
): Promise<void> {
  const filter = ownerKey.userId ? { ownerUserId: ownerKey.userId } : { guestTokenHash: ownerKey.guestTokenHash };
  const setOnInsert = ownerKey.userId
    ? { ownerUserId: new Types.ObjectId(ownerKey.userId) }
    : { guestTokenHash: ownerKey.guestTokenHash };

  await RecentlyViewedModel.findOneAndUpdate(
    filter,
    {
      $setOnInsert: setOnInsert,
      $pull: { items: { productId: new Types.ObjectId(productId) } }
    },
    { upsert: true }
  );

  await RecentlyViewedModel.updateOne(filter, {
    $push: {
      items: {
        $each: [{ productId: new Types.ObjectId(productId), viewedAt: new Date() }],
        $slice: -RECENTLY_VIEWED_MAX_ITEMS
      }
    }
  });
}
