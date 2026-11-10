import type { CartDocument } from '../../models/cart.model.js';
import { toPublicId } from '../../utils/ids.js';

export function toCartDto(cart: CartDocument) {
  return {
    id: toPublicId(cart._id),
    currency: cart.currency,
    items: cart.items.map((item) => ({
      variantId: toPublicId(item.variantId),
      productId: toPublicId(item.productId),
      sellerId: toPublicId(item.sellerId),
      quantity: item.quantity,
      // Explicitly labeled indicative: checkout always recomputes authoritative pricing server-side.
      indicativeUnitPrice: item.indicativeUnitPrice,
      addedAt: item.addedAt.toISOString()
    })),
    updatedAt: cart.updatedAt.toISOString()
  };
}
