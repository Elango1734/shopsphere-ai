import type { CategoryDocument } from '../../models/category.model.js';
import type { BrandDocument } from '../../models/brand.model.js';
import type { ProductDocument } from '../../models/product.model.js';
import type { ProductVariantDocument } from '../../models/productVariant.model.js';
import type { ProductQuestionDocument } from '../../models/productQuestion.model.js';
import { toPublicId } from '../../utils/ids.js';

export function toCategoryDto(category: CategoryDocument) {
  return {
    id: toPublicId(category._id),
    name: category.name,
    slug: category.slug,
    parentId: category.parentId ? toPublicId(category.parentId) : null,
    description: category.description
  };
}

export function toBrandDto(brand: BrandDocument) {
  return { id: toPublicId(brand._id), name: brand.name, slug: brand.slug, description: brand.description };
}

export function toProductSummaryDto(product: ProductDocument) {
  return {
    id: toPublicId(product._id),
    name: product.name,
    slug: product.slug,
    sellerId: toPublicId(product.sellerId),
    categoryId: toPublicId(product.categoryId),
    brandId: product.brandId ? toPublicId(product.brandId) : null,
    images: product.images.map((img) => ({ storageKey: img.storageKey, altText: img.altText })),
    priceRange:
      product.minPriceMinor != null && product.maxPriceMinor != null && product.currency
        ? { minAmountMinor: product.minPriceMinor, maxAmountMinor: product.maxPriceMinor, currency: product.currency }
        : null,
    ratingAverage: product.ratingAggregate.average,
    ratingCount: product.ratingAggregate.count,
    hasAvailableStock: product.hasAvailableStock
  };
}

export function toVariantDto(variant: ProductVariantDocument, availableQuantity: number) {
  const effectivePrice = variant.salePrice ?? variant.regularPrice;
  return {
    id: toPublicId(variant._id),
    sku: variant.sku,
    attributes: Object.fromEntries(variant.attributes),
    price: effectivePrice,
    regularPrice: variant.regularPrice,
    salePrice: variant.salePrice ?? null,
    status: variant.status,
    availableQuantity
  };
}

export function toProductDetailDto(
  product: ProductDocument,
  variants: Array<{ variant: ProductVariantDocument; availableQuantity: number }>
) {
  return {
    ...toProductSummaryDto(product),
    description: product.description,
    attributes: product.attributes,
    returnPolicyRef: product.returnPolicyRef,
    warrantyPolicyRef: product.warrantyPolicyRef,
    variants: variants.map(({ variant, availableQuantity }) => toVariantDto(variant, availableQuantity))
  };
}

export function toQuestionDto(question: ProductQuestionDocument) {
  return {
    id: toPublicId(question._id),
    productId: toPublicId(question.productId),
    askedBy: toPublicId(question.askedBy),
    body: question.body,
    answers: question.answers.map((a) => ({
      id: toPublicId(a._id),
      answeredBy: toPublicId(a.answeredBy),
      isSellerAnswer: a.isSellerAnswer,
      body: a.body,
      answeredAt: a.answeredAt.toISOString()
    })),
    createdAt: question.createdAt.toISOString()
  };
}
