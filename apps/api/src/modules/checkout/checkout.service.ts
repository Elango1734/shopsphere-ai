import { Types } from 'mongoose';
import type { CheckoutInput } from '@shopsphere/validation';
import { withTransaction } from '../../db/transaction.js';
import { getEnv } from '../../config/env.js';
import { ProductVariantModel } from '../../models/productVariant.model.js';
import { ProductModel } from '../../models/product.model.js';
import { CartModel } from '../../models/cart.model.js';
import { CouponModel } from '../../models/coupon.model.js';
import { reserveStock, commitReservation } from '../../repositories/inventory.repository.js';
import { createOrder, type CreateOrderInput } from '../../repositories/order.repository.js';
import { redeemCoupon } from '../../repositories/coupon.repository.js';
import { findOwnedAddress } from '../../repositories/address.repository.js';
import { beginIdempotentOperation, completeIdempotentOperation } from '../../repositories/idempotency.repository.js';
import { UnprocessableError, NotFoundError } from '../../http/errors.js';
import { getRevalidatedCart } from '../cart/cart.service.js';
import { calculatePricing, applyCouponToPricing, applyBestPromotion } from './pricing.service.js';
import { chargeOrder } from '../payments/payment.service.js';
import { recomputeProductPriceAndStockCache } from '../../repositories/product.repository.js';

export class EmptyCartError extends UnprocessableError {
  constructor() {
    super('CART_EMPTY', 'Cannot checkout with an empty cart');
  }
}

export async function checkout(userId: string, idempotencyKey: string, input: CheckoutInput) {
  const idempotency = await beginIdempotentOperation(userId, 'checkout', idempotencyKey, input);
  if (idempotency.kind === 'replay' && idempotency.record.status === 'completed') {
    return idempotency.record.responseSnapshot as Awaited<ReturnType<typeof runCheckout>>;
  }

  const result = await runCheckout(userId, idempotencyKey, input);
  await completeIdempotentOperation(idempotency.record._id.toString(), result, result.orderId);
  return result;
}

async function resolveShippingAddress(userId: string, input: CheckoutInput) {
  if (input.shippingAddressId) {
    const address = await findOwnedAddress(input.shippingAddressId, userId);
    if (!address) throw new NotFoundError('Shipping address not found');
    return address.fields;
  }
  if (input.shippingAddress) return input.shippingAddress;
  throw new UnprocessableError('SHIPPING_ADDRESS_REQUIRED', 'A shipping address is required');
}

async function runCheckout(userId: string, idempotencyKey: string, input: CheckoutInput) {
  const env = getEnv();
  const cart = await getRevalidatedCart({ userId });
  if (cart.items.length === 0) throw new EmptyCartError();

  const shippingAddressSnapshot = await resolveShippingAddress(userId, input);
  const currency = cart.currency;

  const variantIds = cart.items.map((i) => i.variantId);
  const variants = await ProductVariantModel.find({ _id: { $in: variantIds } });
  const variantById = new Map(variants.map((v) => [v._id.toString(), v]));

  const productIds = [...new Set(variants.map((v) => v.productId.toString()))];
  const products = await ProductModel.find({ _id: { $in: productIds } }).select('name categoryId');
  const productById = new Map(products.map((p) => [p._id.toString(), p]));

  const cartLines = cart.items.map((item) => {
    const variant = variantById.get(item.variantId.toString());
    if (!variant) throw new UnprocessableError('VARIANT_UNAVAILABLE', 'A cart item is no longer available');
    const product = productById.get(variant.productId.toString());
    if (!product) throw new UnprocessableError('VARIANT_UNAVAILABLE', 'A cart item is no longer available');
    return { variant, productName: product.name, categoryId: product.categoryId.toString(), quantity: item.quantity };
  });

  let pricing = calculatePricing(cartLines, currency);

  if (input.couponCode) {
    pricing = await applyCouponToPricing(pricing, input.couponCode, userId);
    const coupon = await CouponModel.findOne({ code: input.couponCode.trim().toUpperCase() }).select('stackableWithPromotions');
    if (coupon?.stackableWithPromotions) {
      pricing = await applyBestPromotion(pricing);
    }
  } else {
    pricing = await applyBestPromotion(pricing);
  }

  const expiresAt = new Date(Date.now() + env.CHECKOUT_RESERVATION_MINUTES * 60 * 1000);

  const order = await withTransaction(async (session) => {
    const reservations = [];
    for (const line of pricing.lines) {
      const reservation = await reserveStock(line.variantId, line.quantity, idempotencyKey, expiresAt, session);
      reservations.push(reservation);
    }

    const orderInput: CreateOrderInput = {
      customerId: userId,
      checkoutIdempotencyKey: idempotencyKey,
      items: pricing.lines.map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        sellerId: line.sellerId,
        name: line.name,
        sku: line.sku,
        attributes: line.attributes,
        unitPrice: line.unitPrice,
        discount: line.discount,
        taxAmount: line.taxAmount,
        quantity: line.quantity,
        lineTotal: line.lineTotal
      })),
      itemSubtotal: pricing.itemSubtotal,
      discountTotal: pricing.discountTotal,
      taxTotal: pricing.taxTotal,
      shippingTotal: pricing.shippingTotal,
      grandTotal: pricing.grandTotal,
      shippingAddressSnapshot,
      ...(pricing.appliedCoupon || pricing.appliedPromotion
        ? {
            appliedPromotions: [
              ...(pricing.appliedCoupon
                ? [{ kind: 'coupon' as const, refId: pricing.appliedCoupon.couponId, code: pricing.appliedCoupon.code, discountApplied: pricing.appliedCoupon.discount }]
                : []),
              ...(pricing.appliedPromotion
                ? [{ kind: 'promotion' as const, refId: pricing.appliedPromotion.promotionId, discountApplied: pricing.appliedPromotion.discount }]
                : [])
            ]
          }
        : {})
    };

    const createdOrder = await createOrder(orderInput, session);

    for (const reservation of reservations) {
      await commitReservation(reservation._id.toString(), createdOrder._id.toString(), session);
    }

    if (pricing.appliedCoupon) {
      await redeemCoupon(pricing.appliedCoupon.couponId, userId, createdOrder._id.toString(), pricing.appliedCoupon.discount, session);
    }

    await CartModel.updateOne({ _id: cart._id }, { $set: { items: [] } }, { session });

    return createdOrder;
  });

  for (const line of pricing.lines) {
    await recomputeProductPriceAndStockCache(line.productId);
  }

  const paymentResult = await chargeOrder(order._id.toString(), order.grandTotal, idempotencyKey, input.simulate);

  return {
    orderId: order._id.toString(),
    paymentStatus: paymentResult.order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    grandTotal: order.grandTotal,
    paymentAttemptId: paymentResult.paymentAttemptId
  };
}
