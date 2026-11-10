import { createHash } from 'node:crypto';
import { Types } from 'mongoose';
import { CartModel, type CartDocument } from '../models/cart.model.js';

const MAX_LINE_QUANTITY = 999;
const GUEST_CART_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Guest carts are looked up and stored only by the hash of the opaque token — never the raw token. */
export function hashGuestToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export async function getOrCreateGuestCart(rawGuestToken: string, currency = 'USD'): Promise<CartDocument> {
  const guestTokenHash = hashGuestToken(rawGuestToken);
  const existing = await CartModel.findOne({ guestTokenHash });
  if (existing) return existing;
  return CartModel.create({ guestTokenHash, currency, expiresAt: new Date(Date.now() + GUEST_CART_TTL_MS) });
}

export async function getOrCreateUserCart(userId: string, currency = 'USD'): Promise<CartDocument> {
  const existing = await CartModel.findOne({ ownerUserId: userId });
  if (existing) return existing;
  return CartModel.create({ ownerUserId: userId, currency });
}

export interface CartItemInput {
  variantId: string;
  productId: string;
  sellerId: string;
  quantity: number;
  indicativeUnitPrice: { amountMinor: number; currency: string };
}

/**
 * Adds a line or increases quantity if the variant is already present
 * (dedupe by variantId), capped so a single line cannot exceed
 * MAX_LINE_QUANTITY regardless of how many add-to-cart calls are combined.
 */
export async function addItem(cartId: string, item: CartItemInput): Promise<CartDocument | null> {
  const variantObjectId = new Types.ObjectId(item.variantId);

  const incremented = await CartModel.findOneAndUpdate(
    { _id: cartId, 'items.variantId': variantObjectId },
    { $inc: { 'items.$.quantity': item.quantity } },
    { new: true }
  );
  if (incremented) {
    // MongoDB rejects combining $inc and $min on the same path in one update, so the cap is a second,
    // separate update rather than part of the increment above.
    return CartModel.findOneAndUpdate(
      { _id: cartId, 'items.variantId': variantObjectId },
      { $min: { 'items.$.quantity': MAX_LINE_QUANTITY } },
      { new: true }
    );
  }

  return CartModel.findOneAndUpdate(
    { _id: cartId, 'items.variantId': { $ne: variantObjectId } },
    {
      $push: {
        items: {
          variantId: variantObjectId,
          productId: new Types.ObjectId(item.productId),
          sellerId: new Types.ObjectId(item.sellerId),
          quantity: Math.min(item.quantity, MAX_LINE_QUANTITY),
          indicativeUnitPrice: item.indicativeUnitPrice,
          addedAt: new Date()
        }
      }
    },
    { new: true }
  );
}

export async function updateItemQuantity(
  cartId: string,
  variantId: string,
  quantity: number
): Promise<CartDocument | null> {
  if (quantity <= 0) {
    return CartModel.findOneAndUpdate(
      { _id: cartId },
      { $pull: { items: { variantId: new Types.ObjectId(variantId) } } },
      { new: true }
    );
  }
  return CartModel.findOneAndUpdate(
    { _id: cartId, 'items.variantId': new Types.ObjectId(variantId) },
    { $set: { 'items.$.quantity': Math.min(quantity, MAX_LINE_QUANTITY) } },
    { new: true }
  );
}

export async function removeUnavailableVariants(cartId: string, unavailableVariantIds: string[]): Promise<void> {
  if (unavailableVariantIds.length === 0) return;
  await CartModel.updateOne(
    { _id: cartId },
    { $pull: { items: { variantId: { $in: unavailableVariantIds.map((id) => new Types.ObjectId(id)) } } } }
  );
}

/**
 * Merges a guest cart into the now-authenticated user's cart: for each guest
 * line, the matching user-cart line (same variantId) has its quantity summed
 * and capped; a variant the user cart doesn't have is appended. The guest
 * cart is marked merged (not deleted) so the merge is auditable and
 * idempotent if retried. Deleted/unavailable variants should be filtered by
 * the caller via `removeUnavailableVariants` before merging, per
 * database-design.md's guest-cart-merge requirement.
 */
export async function mergeGuestCartIntoUserCart(guestCartId: string, userId: string): Promise<CartDocument> {
  const [guestCart, userCart] = await Promise.all([
    CartModel.findById(guestCartId),
    getOrCreateUserCart(userId)
  ]);

  if (!guestCart || guestCart.mergedIntoUserId) {
    return userCart;
  }

  for (const guestItem of guestCart.items) {
    const existingLine = userCart.items.find((line) => line.variantId.equals(guestItem.variantId));
    if (existingLine) {
      existingLine.quantity = Math.min(existingLine.quantity + guestItem.quantity, MAX_LINE_QUANTITY);
    } else if (userCart.items.length < 100) {
      userCart.items.push({
        variantId: guestItem.variantId,
        productId: guestItem.productId,
        sellerId: guestItem.sellerId,
        quantity: Math.min(guestItem.quantity, MAX_LINE_QUANTITY),
        indicativeUnitPrice: guestItem.indicativeUnitPrice,
        addedAt: new Date()
      });
    }
  }

  await userCart.save();
  guestCart.mergedIntoUserId = new Types.ObjectId(userId);
  guestCart.items.splice(0, guestCart.items.length);
  await guestCart.save();

  return userCart;
}
