import { Types } from 'mongoose';
import { SellerModel, type SellerDocument } from '../../models/seller.model.js';
import { ProductModel, type ProductDocument } from '../../models/product.model.js';
import { ProductVariantModel, type ProductVariantDocument } from '../../models/productVariant.model.js';
import { InventoryModel } from '../../models/inventory.model.js';
import { CategoryModel } from '../../models/category.model.js';
import { findSellerByOwnerUserId, requireActiveSellerForUser } from '../../repositories/seller.repository.js';
import { grantRole } from '../../repositories/user.repository.js';
import { recomputeProductPriceAndStockCache } from '../../repositories/product.repository.js';
import { upsertOnHand } from '../../repositories/inventory.repository.js';
import { listOrdersForSeller, transitionFulfillmentStatus } from '../../repositories/order.repository.js';
import { getSellerAnalyticsOverview } from '../../repositories/analytics.repository.js';
import { ShipmentModel } from '../../models/shipment.model.js';
import { OrderModel } from '../../models/order.model.js';
import { NotFoundError, ConflictError, UnprocessableError } from '../../http/errors.js';
import type { FulfillmentStatus } from '@shopsphere/shared-types';

export async function onboardSeller(userId: string, input: { storeName: string; description?: string; supportEmail?: string }) {
  const existing = await findSellerByOwnerUserId(userId);
  if (existing) throw new ConflictError('SELLER_ALREADY_EXISTS', 'This account already has a seller profile');

  const slug = slugify(input.storeName);
  const seller = await SellerModel.create({
    ownerUserId: userId,
    storeName: input.storeName,
    slug,
    description: input.description,
    supportEmail: input.supportEmail,
    status: 'pending_review',
    statusHistory: [{ status: 'pending_review', changedAt: new Date() }]
  });
  await grantRole(userId, 'seller');
  return seller;
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${base}-${Date.now().toString(36)}`;
}

export async function getMySeller(userId: string): Promise<SellerDocument> {
  const seller = await findSellerByOwnerUserId(userId);
  if (!seller) throw new NotFoundError('No seller profile for this account');
  return seller;
}

export interface CreateProductInput {
  categoryId: string;
  brandId?: string;
  name: string;
  description?: string;
  attributes?: Array<{ name: string; value: string }>;
  images?: Array<{ storageKey: string; altText?: string; sortOrder?: number }>;
  returnPolicyRef?: string;
  warrantyPolicyRef?: string;
}

export async function createProduct(userId: string, input: CreateProductInput): Promise<ProductDocument> {
  const seller = await requireActiveSellerForUser(userId);
  const category = await CategoryModel.findById(input.categoryId);
  if (!category) throw new UnprocessableError('CATEGORY_NOT_FOUND', 'Category does not exist');

  const slug = slugify(input.name);
  return ProductModel.create({ ...input, sellerId: seller._id, slug, moderationStatus: 'draft' });
}

async function getOwnedProduct(userId: string, productId: string): Promise<ProductDocument> {
  const seller = await requireActiveSellerForUser(userId);
  const product = await ProductModel.findOne({ _id: productId, sellerId: seller._id });
  if (!product) throw new NotFoundError('Product not found');
  return product;
}

export async function updateProduct(userId: string, productId: string, patch: Partial<CreateProductInput>): Promise<ProductDocument> {
  const product = await getOwnedProduct(userId, productId);
  Object.assign(product, patch);
  await product.save();
  return product;
}

export async function submitProductForReview(userId: string, productId: string): Promise<ProductDocument> {
  const product = await getOwnedProduct(userId, productId);
  if (product.moderationStatus !== 'draft' && product.moderationStatus !== 'rejected') {
    throw new ConflictError('INVALID_STATUS_TRANSITION', 'Only a draft or rejected product can be submitted for review');
  }
  product.moderationStatus = 'pending_review';
  await product.save();
  return product;
}

export async function listMyProducts(userId: string, page: number, pageSize: number) {
  const seller = await requireActiveSellerForUser(userId);
  const skip = (page - 1) * pageSize;
  const filter = { sellerId: seller._id, deletedAt: { $exists: false } };
  const [products, totalItems] = await Promise.all([
    ProductModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
    ProductModel.countDocuments(filter)
  ]);
  return { products, totalItems };
}

export interface CreateVariantInput {
  sku: string;
  attributes?: Record<string, string>;
  regularPrice: { amountMinor: number; currency: string };
  salePrice?: { amountMinor: number; currency: string };
  weightGrams?: number;
  barcodeGtin?: string;
  imageStorageKey?: string;
  initialOnHand?: number;
}

export async function createVariant(userId: string, productId: string, input: CreateVariantInput) {
  const product = await getOwnedProduct(userId, productId);
  const variant = await ProductVariantModel.create({
    productId: product._id,
    sellerId: product.sellerId,
    sku: input.sku,
    attributes: input.attributes ?? {},
    regularPrice: input.regularPrice,
    salePrice: input.salePrice,
    status: 'active'
  });
  const inventory = await InventoryModel.create({
    variantId: variant._id,
    sellerId: product.sellerId,
    onHand: input.initialOnHand ?? 0,
    reserved: 0
  });
  await recomputeProductPriceAndStockCache(product._id.toString());
  return { variant, inventory };
}

async function getOwnedVariant(userId: string, variantId: string): Promise<ProductVariantDocument> {
  const seller = await requireActiveSellerForUser(userId);
  const variant = await ProductVariantModel.findOne({ _id: variantId, sellerId: seller._id });
  if (!variant) throw new NotFoundError('Variant not found');
  return variant;
}

export async function updateVariant(userId: string, variantId: string, patch: Partial<CreateVariantInput>): Promise<ProductVariantDocument> {
  const variant = await getOwnedVariant(userId, variantId);
  Object.assign(variant, patch);
  await variant.save();
  await recomputeProductPriceAndStockCache(variant.productId.toString());
  return variant;
}

export async function updateInventory(userId: string, variantId: string, onHand: number, lowStockThreshold?: number): Promise<void> {
  const variant = await getOwnedVariant(userId, variantId);
  await upsertOnHand(variant._id.toString(), variant.sellerId.toString(), onHand);
  if (lowStockThreshold != null) {
    await InventoryModel.updateOne({ variantId: variant._id }, { $set: { lowStockThreshold } });
  }
  await recomputeProductPriceAndStockCache(variant.productId.toString());
}

export async function listVariantsForProduct(userId: string, productId: string) {
  const product = await getOwnedProduct(userId, productId);
  const variants = await ProductVariantModel.find({ productId: product._id, deletedAt: { $exists: false } });
  const inventories = await InventoryModel.find({ variantId: { $in: variants.map((v) => v._id) } });
  const inventoryByVariant = new Map(inventories.map((i) => [i.variantId.toString(), i]));
  return variants.map((variant) => ({ variant, inventory: inventoryByVariant.get(variant._id.toString()) ?? null }));
}

export async function listLowStockVariants(userId: string) {
  const seller = await requireActiveSellerForUser(userId);
  return InventoryModel.find({
    sellerId: seller._id,
    $expr: { $lte: [{ $subtract: ['$onHand', '$reserved'] }, '$lowStockThreshold'] }
  });
}

export async function listSellerOrdersForUser(userId: string, page: number, pageSize: number, fulfillmentStatus?: FulfillmentStatus) {
  const seller = await requireActiveSellerForUser(userId);
  return listOrdersForSeller(seller._id.toString(), page, pageSize, fulfillmentStatus);
}

export async function getMyAnalytics(userId: string, rangeDays: number) {
  const seller = await requireActiveSellerForUser(userId);
  return getSellerAnalyticsOverview(seller._id.toString(), rangeDays);
}

async function assertOrderBelongsToSeller(sellerId: Types.ObjectId, orderId: string) {
  const order = await OrderModel.findOne({ _id: orderId, sellerIds: sellerId });
  if (!order) throw new NotFoundError('Order not found for this seller');
  return order;
}

export async function updateOrderFulfillmentForSeller(
  userId: string,
  orderId: string,
  status: FulfillmentStatus,
  note?: string
) {
  const seller = await requireActiveSellerForUser(userId);
  await assertOrderBelongsToSeller(seller._id, orderId);
  return transitionFulfillmentStatus(orderId, status, { changedBy: userId, ...(note ? { note } : {}) });
}

export async function createShipmentForSeller(
  userId: string,
  orderId: string,
  input: { carrier?: string; trackingNumber?: string; variantIds: string[] }
) {
  const seller = await requireActiveSellerForUser(userId);
  await assertOrderBelongsToSeller(seller._id, orderId);

  return ShipmentModel.create({
    orderId,
    sellerId: seller._id,
    orderItemVariantIds: input.variantIds,
    carrier: input.carrier,
    trackingNumber: input.trackingNumber,
    status: 'label_created',
    trackingEvents: [{ status: 'label_created', occurredAt: new Date() }]
  });
}
