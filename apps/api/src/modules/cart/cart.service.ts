import { CartModel, type CartDocument } from '../../models/cart.model.js';
import { ProductVariantModel } from '../../models/productVariant.model.js';
import {
  getOrCreateGuestCart,
  getOrCreateUserCart,
  addItem as addItemToCart,
  updateItemQuantity,
  removeUnavailableVariants,
  mergeGuestCartIntoUserCart,
  hashGuestToken
} from '../../repositories/cart.repository.js';
import { NotFoundError, UnprocessableError } from '../../http/errors.js';

export interface CartOwner {
  userId?: string;
  guestToken?: string;
}

export async function resolveCart(owner: CartOwner): Promise<CartDocument> {
  if (owner.userId) return getOrCreateUserCart(owner.userId);
  if (owner.guestToken) return getOrCreateGuestCart(owner.guestToken);
  throw new UnprocessableError('CART_OWNER_REQUIRED', 'A guest token or authenticated user is required');
}

export async function addVariantToCart(owner: CartOwner, variantId: string, quantity: number): Promise<CartDocument> {
  const variant = await ProductVariantModel.findOne({ _id: variantId, status: 'active', deletedAt: { $exists: false } });
  if (!variant) throw new NotFoundError('Product variant not available');

  const cart = await resolveCart(owner);
  const updated = await addItemToCart(cart._id.toString(), {
    variantId,
    productId: variant.productId.toString(),
    sellerId: variant.sellerId.toString(),
    quantity,
    indicativeUnitPrice: variant.salePrice ?? variant.regularPrice
  });
  if (!updated) throw new NotFoundError('Cart not found');
  return updated;
}

export async function updateCartItem(owner: CartOwner, variantId: string, quantity: number): Promise<CartDocument> {
  const cart = await resolveCart(owner);
  const updated = await updateItemQuantity(cart._id.toString(), variantId, quantity);
  if (!updated) throw new NotFoundError('Cart item not found');
  return updated;
}

/**
 * Revalidates every cart line against current catalog state before it is
 * shown or merged: deleted/inactive variants are dropped (never silently
 * kept as if still purchasable) — database-design.md's "revalidate all
 * prices and inventory during checkout" starts here, at read time.
 */
export async function getRevalidatedCart(owner: CartOwner): Promise<CartDocument> {
  const cart = await resolveCart(owner);
  if (cart.items.length === 0) return cart;

  const variantIds = cart.items.map((i) => i.variantId);
  const activeVariants = await ProductVariantModel.find({
    _id: { $in: variantIds },
    status: 'active',
    deletedAt: { $exists: false }
  }).select('_id');
  const activeIds = new Set(activeVariants.map((v) => v._id.toString()));
  const unavailable = cart.items.map((i) => i.variantId.toString()).filter((id) => !activeIds.has(id));

  if (unavailable.length > 0) {
    await removeUnavailableVariants(cart._id.toString(), unavailable);
    return (await resolveCart(owner)) as CartDocument;
  }
  return cart;
}

export async function mergeGuestCartOnLogin(userId: string, rawGuestToken: string): Promise<CartDocument> {
  const guestTokenHash = hashGuestToken(rawGuestToken);
  const guestCart = await CartModel.findOne({ guestTokenHash });
  if (!guestCart) return getOrCreateUserCart(userId);

  const variantIds = guestCart.items.map((i) => i.variantId);
  const activeVariants = await ProductVariantModel.find({ _id: { $in: variantIds }, status: 'active', deletedAt: { $exists: false } }).select(
    '_id'
  );
  const activeIds = new Set(activeVariants.map((v) => v._id.toString()));
  const unavailable = guestCart.items.map((i) => i.variantId.toString()).filter((id) => !activeIds.has(id));
  if (unavailable.length > 0) {
    await removeUnavailableVariants(guestCart._id.toString(), unavailable);
  }

  return mergeGuestCartIntoUserCart(guestCart._id.toString(), userId);
}
