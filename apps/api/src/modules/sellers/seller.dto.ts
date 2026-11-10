import type { SellerDocument } from '../../models/seller.model.js';
import type { ProductDocument } from '../../models/product.model.js';
import type { ProductVariantDocument } from '../../models/productVariant.model.js';
import type { InventoryDocument } from '../../models/inventory.model.js';
import { toPublicId } from '../../utils/ids.js';

export function toSellerDto(seller: SellerDocument) {
  return {
    id: toPublicId(seller._id),
    storeName: seller.storeName,
    slug: seller.slug,
    status: seller.status,
    description: seller.description,
    supportEmail: seller.supportEmail,
    createdAt: seller.createdAt.toISOString()
  };
}

export function toSellerProductDto(product: ProductDocument) {
  return {
    id: toPublicId(product._id),
    name: product.name,
    slug: product.slug,
    categoryId: toPublicId(product.categoryId),
    brandId: product.brandId ? toPublicId(product.brandId) : null,
    moderationStatus: product.moderationStatus,
    moderationNote: product.moderationNote,
    hasAvailableStock: product.hasAvailableStock,
    createdAt: product.createdAt.toISOString()
  };
}

export function toSellerVariantDto(variant: ProductVariantDocument, inventory?: InventoryDocument | null) {
  return {
    id: toPublicId(variant._id),
    productId: toPublicId(variant.productId),
    sku: variant.sku,
    attributes: Object.fromEntries(variant.attributes),
    regularPrice: variant.regularPrice,
    salePrice: variant.salePrice ?? null,
    status: variant.status,
    inventory: inventory
      ? { onHand: inventory.onHand, reserved: inventory.reserved, available: inventory.onHand - inventory.reserved, lowStockThreshold: inventory.lowStockThreshold }
      : null
  };
}
