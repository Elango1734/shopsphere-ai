import type { Request, Response } from 'express';
import { sendSuccess } from '../../http/envelope.js';
import { getWishlist, toggleWishlistItem } from '../../repositories/discovery.repository.js';
import { RecentlyViewedModel } from '../../models/recentlyViewed.model.js';
import { findPublishedProductsByIds } from '../../repositories/product.repository.js';
import { toProductSummaryDto } from '../catalog/catalog.dto.js';
import { toPublicId } from '../../utils/ids.js';
import { hashGuestToken } from '../../repositories/cart.repository.js';

async function enrichWithProducts<T extends { productId: unknown }>(items: T[]) {
  const ids = items.map((item) => String(item.productId));
  const products = await findPublishedProductsByIds(ids);
  const byId = new Map(products.map((p) => [p._id.toString(), toProductSummaryDto(p)]));
  return items.map((item) => ({ ...item, product: byId.get(String(item.productId)) ?? null }));
}

export async function getWishlistHandler(req: Request, res: Response): Promise<void> {
  const wishlist = await getWishlist(req.auth!.userId);
  const items = wishlist?.items ?? [];
  const enriched = await enrichWithProducts(
    items.map((i) => ({ productId: i.productId, variantId: i.variantId ? toPublicId(i.variantId) : null, addedAt: i.addedAt.toISOString() }))
  );
  sendSuccess(res, enriched);
}

export async function toggleWishlistHandler(req: Request, res: Response): Promise<void> {
  const { productId, variantId } = req.body as { productId: string; variantId?: string };
  const action = await toggleWishlistItem(req.auth!.userId, productId, variantId);
  sendSuccess(res, { action });
}

export async function getRecentlyViewedHandler(req: Request, res: Response): Promise<void> {
  const filter = req.auth?.userId
    ? { ownerUserId: req.auth.userId }
    : { guestTokenHash: hashGuestToken(req.guestToken) };
  const doc = await RecentlyViewedModel.findOne(filter);
  const items = (doc?.items ?? [])
    .slice()
    .reverse()
    .map((i) => ({ productId: toPublicId(i.productId), viewedAt: i.viewedAt.toISOString() }));
  const enriched = await enrichWithProducts(items);
  sendSuccess(res, enriched);
}
