import type { Money } from '@shopsphere/shared-types';
import type { ProductVariantDocument } from '../../models/productVariant.model.js';
import { findActiveCouponByCode, getUserRedemptionCount } from '../../repositories/coupon.repository.js';
import { PromotionModel } from '../../models/promotion.model.js';
import { getEnv } from '../../config/env.js';
import { UnprocessableError } from '../../http/errors.js';
import { zeroMoney } from '../../utils/money.js';

export interface PricedLine {
  variantId: string;
  productId: string;
  sellerId: string;
  name: string;
  sku: string;
  attributes: Record<string, string>;
  quantity: number;
  unitPrice: Money;
  lineSubtotal: Money;
  categoryId: string;
}

export interface PricingResult {
  lines: Array<PricedLine & { discount: Money; taxAmount: Money; lineTotal: Money }>;
  itemSubtotal: Money;
  discountTotal: Money;
  taxTotal: Money;
  shippingTotal: Money;
  grandTotal: Money;
  currency: string;
  appliedCoupon?: { couponId: string; code: string; discount: Money };
  appliedPromotion?: { promotionId: string; discount: Money };
}

/**
 * Allocates a total discount/tax across order lines proportional to each
 * line's share of the subtotal, with the rounding remainder assigned to the
 * last line so the sum of allocations always equals the input total exactly
 * — required so order-item snapshots add up to the order-level totals they
 * must support refunds/support queries against.
 */
function allocateProportionally(totalMinor: number, lineSubtotalsMinor: number[]): number[] {
  if (totalMinor === 0 || lineSubtotalsMinor.length === 0) return lineSubtotalsMinor.map(() => 0);
  const grandSubtotal = lineSubtotalsMinor.reduce((a, b) => a + b, 0);
  if (grandSubtotal === 0) return lineSubtotalsMinor.map(() => 0);

  const allocations = lineSubtotalsMinor.map((amount) => Math.floor((amount / grandSubtotal) * totalMinor));
  const allocated = allocations.reduce((a, b) => a + b, 0);
  const remainder = totalMinor - allocated;
  allocations[allocations.length - 1] = (allocations[allocations.length - 1] ?? 0) + remainder;
  return allocations;
}

/**
 * Tax and shipping are flat placeholder policies for this implementation
 * stage (a configurable flat basis-point tax rate and a flat shipping fee
 * with a free-shipping threshold) rather than a real tax-jurisdiction or
 * carrier-rate integration — api-specification.md's "tax calculation through
 * a configurable tax policy" is satisfied structurally (this function is the
 * single seam a real policy would replace) but not with real-world accuracy.
 * Documented as a known limitation in docs/database-design.md / README.
 */
export function calculatePricing(
  cartLines: Array<{ variant: ProductVariantDocument; productName: string; categoryId: string; quantity: number }>,
  currency: string
): PricingResult {
  const env = getEnv();

  const lines: PricedLine[] = cartLines.map(({ variant, productName, categoryId, quantity }) => {
    const unitPrice = variant.salePrice ?? variant.regularPrice;
    return {
      variantId: variant._id.toString(),
      productId: variant.productId.toString(),
      sellerId: variant.sellerId.toString(),
      name: productName,
      sku: variant.sku,
      attributes: Object.fromEntries(variant.attributes),
      quantity,
      unitPrice,
      lineSubtotal: { amountMinor: unitPrice.amountMinor * quantity, currency: unitPrice.currency },
      categoryId
    };
  });

  const itemSubtotalMinor = lines.reduce((sum, l) => sum + l.lineSubtotal.amountMinor, 0);
  const itemSubtotal: Money = { amountMinor: itemSubtotalMinor, currency };

  const taxableBaseMinor = itemSubtotalMinor; // discount applied before allocating tax, computed below
  const shippingTotal: Money = {
    amountMinor: itemSubtotalMinor >= env.FREE_SHIPPING_THRESHOLD_MINOR ? 0 : env.FLAT_SHIPPING_MINOR,
    currency
  };

  const discountAllocations = allocateProportionally(
    0,
    lines.map((l) => l.lineSubtotal.amountMinor)
  );
  const taxAllocations = allocateProportionally(
    Math.round((taxableBaseMinor * env.TAX_RATE_BASIS_POINTS) / 10_000),
    lines.map((l) => l.lineSubtotal.amountMinor)
  );

  const pricedLines = lines.map((line, index) => {
    const discount: Money = { amountMinor: discountAllocations[index] ?? 0, currency };
    const taxAmount: Money = { amountMinor: taxAllocations[index] ?? 0, currency };
    const lineTotal: Money = {
      amountMinor: line.lineSubtotal.amountMinor - discount.amountMinor + taxAmount.amountMinor,
      currency
    };
    return { ...line, discount, taxAmount, lineTotal };
  });

  const discountTotal = zeroMoney(currency);
  const taxTotal: Money = { amountMinor: taxAllocations.reduce((a, b) => a + b, 0), currency };
  const grandTotal: Money = {
    amountMinor: itemSubtotal.amountMinor - discountTotal.amountMinor + taxTotal.amountMinor + shippingTotal.amountMinor,
    currency
  };

  return { lines: pricedLines, itemSubtotal, discountTotal, taxTotal, shippingTotal, grandTotal, currency };
}

/**
 * Recomputes a PricingResult with a coupon's discount applied, re-deriving
 * tax from the post-discount base (tax should apply to what the customer
 * actually pays) and re-allocating discount/tax per line. Separate from
 * `calculatePricing` so pricing can be computed once and then either kept
 * coupon-free or re-priced with a coupon, without duplicating line setup.
 */
export async function applyCouponToPricing(pricing: PricingResult, code: string, userId: string): Promise<PricingResult> {
  const coupon = await findActiveCouponByCode(code);
  if (!coupon) throw new UnprocessableError('COUPON_NOT_ELIGIBLE', 'Coupon is invalid, expired, or inactive');

  if (coupon.currency !== pricing.currency) {
    throw new UnprocessableError('COUPON_NOT_ELIGIBLE', 'Coupon currency does not match cart currency');
  }
  if (coupon.minOrderAmount && pricing.itemSubtotal.amountMinor < coupon.minOrderAmount.amountMinor) {
    throw new UnprocessableError('COUPON_NOT_ELIGIBLE', 'Order does not meet the coupon minimum amount');
  }
  const redemptions = await getUserRedemptionCount(coupon._id.toString(), userId);
  if (redemptions >= coupon.perUserLimit) {
    throw new UnprocessableError('COUPON_NOT_ELIGIBLE', 'You have already used this coupon');
  }
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    throw new UnprocessableError('COUPON_NOT_ELIGIBLE', 'Coupon usage limit reached');
  }

  const eligibleCategoryIds = coupon.eligibleCategoryIds.map((id) => id.toString());
  const eligibleProductIds = coupon.eligibleProductIds.map((id) => id.toString());
  const isRestricted = eligibleCategoryIds.length > 0 || eligibleProductIds.length > 0;

  const eligibleLines = isRestricted
    ? pricing.lines.filter((line) => eligibleCategoryIds.includes(line.categoryId) || eligibleProductIds.includes(line.productId))
    : pricing.lines;
  const eligibleSubtotalMinor = eligibleLines.reduce((sum, l) => sum + l.lineSubtotal.amountMinor, 0);

  let discountMinor =
    coupon.discountType === 'percentage'
      ? Math.round((eligibleSubtotalMinor * (coupon.percentageBasisPoints ?? 0)) / 10_000)
      : Math.min(coupon.discountValue?.amountMinor ?? 0, eligibleSubtotalMinor);

  if (coupon.maxDiscount) {
    discountMinor = Math.min(discountMinor, coupon.maxDiscount.amountMinor);
  }

  return recomputeWithDiscount(pricing, discountMinor, {
    couponId: coupon._id.toString(),
    code: coupon.code,
    discount: { amountMinor: discountMinor, currency: pricing.currency }
  });
}

async function findBestActivePromotion(categoryIds: string[]) {
  const now = new Date();
  return PromotionModel.findOne({
    isActive: true,
    startsAt: { $lte: now },
    expiresAt: { $gte: now },
    $or: [{ eligibleCategoryIds: { $size: 0 } }, { eligibleCategoryIds: { $in: categoryIds } }]
  }).sort({ priority: -1 });
}

export async function applyBestPromotion(pricing: PricingResult): Promise<PricingResult> {
  const categoryIds = [...new Set(pricing.lines.map((l) => l.categoryId))];
  const promotion = await findBestActivePromotion(categoryIds);
  if (!promotion || promotion.currency !== pricing.currency) return pricing;
  if (promotion.minOrderAmount && pricing.itemSubtotal.amountMinor < promotion.minOrderAmount.amountMinor) return pricing;

  const eligibleCategoryIds = promotion.eligibleCategoryIds.map((id) => id.toString());
  const eligibleLines =
    eligibleCategoryIds.length > 0 ? pricing.lines.filter((l) => eligibleCategoryIds.includes(l.categoryId)) : pricing.lines;
  const eligibleSubtotalMinor = eligibleLines.reduce((sum, l) => sum + l.lineSubtotal.amountMinor, 0);
  if (eligibleSubtotalMinor === 0) return pricing;

  let discountMinor =
    promotion.discountType === 'percentage'
      ? Math.round((eligibleSubtotalMinor * (promotion.percentageBasisPoints ?? 0)) / 10_000)
      : Math.min(promotion.discountValue?.amountMinor ?? 0, eligibleSubtotalMinor);
  if (promotion.maxDiscount) discountMinor = Math.min(discountMinor, promotion.maxDiscount.amountMinor);

  return recomputeWithDiscount(pricing, discountMinor, undefined, {
    promotionId: promotion._id.toString(),
    discount: { amountMinor: discountMinor, currency: pricing.currency }
  });
}

function recomputeWithDiscount(
  pricing: PricingResult,
  additionalDiscountMinor: number,
  appliedCoupon?: PricingResult['appliedCoupon'],
  appliedPromotion?: PricingResult['appliedPromotion']
): PricingResult {
  const env = getEnv();
  const existingDiscountMinor = pricing.discountTotal.amountMinor;
  const newDiscountMinor = existingDiscountMinor + additionalDiscountMinor;
  const taxableBaseMinor = Math.max(0, pricing.itemSubtotal.amountMinor - newDiscountMinor);

  const discountAllocations = allocateProportionally(
    newDiscountMinor,
    pricing.lines.map((l) => l.lineSubtotal.amountMinor)
  );
  const taxAllocations = allocateProportionally(
    Math.round((taxableBaseMinor * env.TAX_RATE_BASIS_POINTS) / 10_000),
    pricing.lines.map((l) => l.lineSubtotal.amountMinor)
  );

  const lines = pricing.lines.map((line, index) => {
    const discount: Money = { amountMinor: discountAllocations[index] ?? 0, currency: pricing.currency };
    const taxAmount: Money = { amountMinor: taxAllocations[index] ?? 0, currency: pricing.currency };
    const lineTotal: Money = {
      amountMinor: line.lineSubtotal.amountMinor - discount.amountMinor + taxAmount.amountMinor,
      currency: pricing.currency
    };
    return { ...line, discount, taxAmount, lineTotal };
  });

  const discountTotal: Money = { amountMinor: newDiscountMinor, currency: pricing.currency };
  const taxTotal: Money = { amountMinor: taxAllocations.reduce((a, b) => a + b, 0), currency: pricing.currency };
  const grandTotal: Money = {
    amountMinor:
      pricing.itemSubtotal.amountMinor - discountTotal.amountMinor + taxTotal.amountMinor + pricing.shippingTotal.amountMinor,
    currency: pricing.currency
  };

  return {
    ...pricing,
    lines,
    discountTotal,
    taxTotal,
    grandTotal,
    ...(appliedCoupon ? { appliedCoupon } : {}),
    ...(appliedPromotion ? { appliedPromotion } : {})
  };
}
