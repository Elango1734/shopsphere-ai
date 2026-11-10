import { Types } from 'mongoose';
import { ProductModel, type ProductDocument } from '../models/product.model.js';
import { ProductVariantModel } from '../models/productVariant.model.js';
import { InventoryModel } from '../models/inventory.model.js';

export interface CatalogFilter {
  categoryId?: string;
  brandId?: string;
  sellerId?: string;
  minPriceMinor?: number;
  maxPriceMinor?: number;
  searchText?: string;
  inStockOnly?: boolean;
}

export interface CatalogPage {
  products: ProductDocument[];
  totalItems: number;
}

const MAX_PAGE_SIZE = 100;

/**
 * Every catalog list endpoint must go through a bounded, indexed query like
 * this one — never an unbounded `find({})` — per database-design.md and
 * testing.md. `page`/`pageSize` are clamped server-side regardless of what a
 * client requests.
 */
export async function listPublishedProducts(
  filter: CatalogFilter,
  page: number,
  pageSize: number,
  sort: Record<string, 1 | -1> = { createdAt: -1 }
): Promise<CatalogPage> {
  const boundedPageSize = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE);
  const boundedPage = Math.max(page, 1);

  const query: Record<string, unknown> = { moderationStatus: 'published', deletedAt: { $exists: false } };
  if (filter.categoryId) query.categoryId = filter.categoryId;
  if (filter.brandId) query.brandId = filter.brandId;
  if (filter.sellerId) query.sellerId = filter.sellerId;
  if (filter.inStockOnly) query.hasAvailableStock = true;
  if (filter.minPriceMinor != null || filter.maxPriceMinor != null) {
    query.minPriceMinor = {
      ...(filter.minPriceMinor != null ? { $gte: filter.minPriceMinor } : {}),
      ...(filter.maxPriceMinor != null ? { $lte: filter.maxPriceMinor } : {})
    };
  }
  if (filter.searchText) {
    query.$text = { $search: filter.searchText };
  }

  const skip = (boundedPage - 1) * boundedPageSize;
  // _id as a deterministic tie-breaker so pagination stays stable when the sort key has duplicate values.
  const stableSort = { ...sort, _id: -1 as const };

  const [products, totalItems] = await Promise.all([
    ProductModel.find(query).sort(stableSort).skip(skip).limit(boundedPageSize),
    ProductModel.countDocuments(query)
  ]);

  return { products, totalItems };
}

export async function findPublishedProductBySlug(slug: string): Promise<ProductDocument | null> {
  return ProductModel.findOne({ slug, moderationStatus: 'published', deletedAt: { $exists: false } });
}

export async function findPublishedProductsByIds(ids: string[]): Promise<ProductDocument[]> {
  return ProductModel.find({ _id: { $in: ids }, moderationStatus: 'published', deletedAt: { $exists: false } });
}

/**
 * Keeps Product.minPriceMinor/maxPriceMinor/hasAvailableStock in sync after a
 * variant's price or an inventory level changes, so catalog price filtering
 * and stock-visibility queries never need a $lookup against variants on the
 * read path. Called by the variant/inventory services after their own writes
 * — not a live trigger, so there is a brief window of staleness, which is an
 * accepted tradeoff documented in database-design.md's indexing section.
 */
export async function recomputeProductPriceAndStockCache(productId: string): Promise<void> {
  const variants = await ProductVariantModel.find({ productId, status: 'active', deletedAt: { $exists: false } });
  if (variants.length === 0) {
    await ProductModel.updateOne(
      { _id: productId },
      { $set: { hasAvailableStock: false }, $unset: { minPriceMinor: 1, maxPriceMinor: 1 } }
    );
    return;
  }

  const effectivePrices = variants.map((v) => (v.salePrice ?? v.regularPrice).amountMinor);
  const currency = variants[0]!.regularPrice.currency;

  const variantIds = variants.map((v) => v._id);
  const inventories = await InventoryModel.find({ variantId: { $in: variantIds } });
  const hasAvailableStock = inventories.some((inv) => inv.onHand - inv.reserved > 0);

  await ProductModel.updateOne(
    { _id: productId },
    {
      $set: {
        minPriceMinor: Math.min(...effectivePrices),
        maxPriceMinor: Math.max(...effectivePrices),
        currency,
        hasAvailableStock
      }
    }
  );
}

export async function isSlugTaken(slug: string, excludeProductId?: string): Promise<boolean> {
  const query: Record<string, unknown> = { slug };
  if (excludeProductId) query._id = { $ne: new Types.ObjectId(excludeProductId) };
  return (await ProductModel.countDocuments(query)) > 0;
}
