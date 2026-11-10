import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { Types } from 'mongoose';
import { startMemoryReplicaSet, stopMemoryReplicaSet, clearAllCollections } from '../setup/memoryReplSet.js';
import { ProductModel } from '../../src/models/product.model.js';
import { ProductVariantModel } from '../../src/models/productVariant.model.js';

beforeAll(async () => {
  await startMemoryReplicaSet();
}, 120_000);
afterAll(async () => {
  await stopMemoryReplicaSet();
});
afterEach(async () => {
  await clearAllCollections();
});

function baseProduct(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    sellerId: new Types.ObjectId(),
    categoryId: new Types.ObjectId(),
    name: 'Test Product',
    slug: 'test-product',
    ...overrides
  };
}

describe('Product schema', () => {
  it('enforces a unique slug', async () => {
    await ProductModel.create(baseProduct());
    await expect(ProductModel.create(baseProduct({ slug: 'test-product' }))).rejects.toMatchObject({ code: 11000 });
  });

  it('rejects more than the maximum number of images', async () => {
    const images = Array.from({ length: 13 }, (_, i) => ({ storageKey: `img-${i}` }));
    const product = new ProductModel(baseProduct({ images }));
    await expect(product.validate()).rejects.toThrow(/at most 12 images/);
  });

  it('defaults to a zeroed rating aggregate, never trusting client input', async () => {
    const product = await ProductModel.create(baseProduct());
    expect(product.ratingAggregate.count).toBe(0);
    expect(product.ratingAggregate.average).toBe(0);
    expect(product.ratingAggregate.distribution).toEqual([0, 0, 0, 0, 0]);
  });
});

describe('ProductVariant schema', () => {
  it('enforces SKU uniqueness scoped per seller, not globally', async () => {
    const sellerA = new Types.ObjectId();
    const sellerB = new Types.ObjectId();
    const productId = new Types.ObjectId();

    await ProductVariantModel.create({
      productId,
      sellerId: sellerA,
      sku: 'SAME-SKU',
      regularPrice: { amountMinor: 1000, currency: 'USD' }
    });

    // Same SKU string, different seller: allowed.
    await expect(
      ProductVariantModel.create({
        productId,
        sellerId: sellerB,
        sku: 'SAME-SKU',
        regularPrice: { amountMinor: 1200, currency: 'USD' }
      })
    ).resolves.toBeDefined();

    // Same SKU, same seller: rejected.
    await expect(
      ProductVariantModel.create({
        productId,
        sellerId: sellerA,
        sku: 'SAME-SKU',
        regularPrice: { amountMinor: 1500, currency: 'USD' }
      })
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('rejects a sale price greater than the regular price', async () => {
    const variant = new ProductVariantModel({
      productId: new Types.ObjectId(),
      sellerId: new Types.ObjectId(),
      sku: 'BAD-SALE',
      regularPrice: { amountMinor: 1000, currency: 'USD' },
      salePrice: { amountMinor: 1500, currency: 'USD' }
    });
    await expect(variant.validate()).rejects.toThrow(/salePrice must not exceed regularPrice/);
  });
});
