import { Types } from 'mongoose';
import { UserModel } from '../../models/user.model.js';
import { SellerModel } from '../../models/seller.model.js';
import { CategoryModel } from '../../models/category.model.js';
import { BrandModel } from '../../models/brand.model.js';
import { ProductModel } from '../../models/product.model.js';
import { OrderModel } from '../../models/order.model.js';
import { ReturnRequestModel } from '../../models/returnRequest.model.js';
import { ReviewModel } from '../../models/review.model.js';
import { CouponModel } from '../../models/coupon.model.js';
import { PaymentAttemptModel } from '../../models/paymentAttempt.model.js';
import { transitionSellerStatus } from '../../repositories/seller.repository.js';
import { applyRatingDelta } from '../../repositories/review.repository.js';
import { transitionFulfillmentStatus } from '../../repositories/order.repository.js';
import { issueRefund } from '../payments/payment.service.js';
import { appendAuditLog } from '../../repositories/auditLog.repository.js';
import { listAuditLogsForResource } from '../../repositories/auditLog.repository.js';
import { AuditLogModel } from '../../models/auditLog.model.js';
import { NotFoundError, ConflictError, UnprocessableError } from '../../http/errors.js';
import { getAnalyticsOverview } from '../../repositories/analytics.repository.js';
import { AiConversationModel } from '../../models/aiConversation.model.js';
import { AiMessageModel } from '../../models/aiMessage.model.js';
import { getEnv } from '../../config/env.js';
import type { UserRole, SellerStatus } from '@shopsphere/shared-types';

export interface AdminActorContext {
  actorUserId: string;
  requestId: string;
}

async function audit(ctx: AdminActorContext, action: string, resourceType: string, resourceId: string, before?: unknown, after?: unknown) {
  await appendAuditLog({
    actorUserId: ctx.actorUserId,
    actorRole: 'administrator',
    action,
    resourceType,
    resourceId,
    requestId: ctx.requestId,
    ...(before !== undefined ? { beforeSummary: before as Record<string, unknown> } : {}),
    ...(after !== undefined ? { afterSummary: after as Record<string, unknown> } : {})
  });
}

export async function listUsers(page: number, pageSize: number, role?: UserRole, status?: string) {
  const filter: Record<string, unknown> = {};
  if (role) filter.roles = role;
  if (status) filter.status = status;
  const skip = (page - 1) * pageSize;
  const [users, totalItems] = await Promise.all([
    UserModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
    UserModel.countDocuments(filter)
  ]);
  return { users, totalItems };
}

export async function changeUserStatus(ctx: AdminActorContext, userId: string, status: 'active' | 'suspended', note?: string) {
  const user = await UserModel.findById(userId);
  if (!user) throw new NotFoundError('User not found');
  const before = { status: user.status };
  user.status = status;
  await user.save();
  await audit(ctx, 'user.status_change', 'User', userId, before, { status, note });
  return user;
}

export async function listSellers(page: number, pageSize: number, status?: SellerStatus) {
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  const skip = (page - 1) * pageSize;
  const [sellers, totalItems] = await Promise.all([
    SellerModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
    SellerModel.countDocuments(filter)
  ]);
  return { sellers, totalItems };
}

export async function changeSellerStatus(ctx: AdminActorContext, sellerId: string, status: SellerStatus, note?: string) {
  const existing = await SellerModel.findById(sellerId);
  if (!existing) throw new NotFoundError('Seller not found');
  const before = { status: existing.status };
  const updated = await transitionSellerStatus(sellerId, status, ctx.actorUserId, note);
  await audit(ctx, 'seller.status_change', 'Seller', sellerId, before, { status, note });
  return updated!;
}

export async function createCategory(ctx: AdminActorContext, input: { name: string; slug: string; parentId?: string; description?: string }) {
  const category = await CategoryModel.create(input);
  await audit(ctx, 'category.create', 'Category', category._id.toString(), undefined, input);
  return category;
}

export async function createBrand(ctx: AdminActorContext, input: { name: string; slug: string; description?: string }) {
  const brand = await BrandModel.create(input);
  await audit(ctx, 'brand.create', 'Brand', brand._id.toString(), undefined, input);
  return brand;
}

export async function listProductsForModeration(
  page: number,
  pageSize: number,
  filters: { moderationStatus?: string; categoryId?: string; sellerId?: string }
) {
  const filter: Record<string, unknown> = { deletedAt: { $exists: false } };
  if (filters.moderationStatus) filter.moderationStatus = filters.moderationStatus;
  if (filters.categoryId) filter.categoryId = filters.categoryId;
  if (filters.sellerId) filter.sellerId = filters.sellerId;
  const skip = (page - 1) * pageSize;
  const [products, totalItems] = await Promise.all([
    ProductModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
    ProductModel.countDocuments(filter)
  ]);
  return { products, totalItems };
}

export async function moderateProduct(ctx: AdminActorContext, productId: string, status: 'published' | 'rejected' | 'archived', note?: string) {
  const product = await ProductModel.findById(productId);
  if (!product) throw new NotFoundError('Product not found');
  if (product.moderationStatus !== 'pending_review' && status === 'published') {
    throw new ConflictError('INVALID_STATUS_TRANSITION', 'Only a product pending review can be published');
  }
  const before = { moderationStatus: product.moderationStatus };
  product.moderationStatus = status;
  if (note) product.moderationNote = note;
  await product.save();
  await audit(ctx, 'product.moderate', 'Product', productId, before, { status, note });
  return product;
}

export async function searchOrders(page: number, pageSize: number, filters: { paymentStatus?: string; fulfillmentStatus?: string; customerEmail?: string }) {
  const filter: Record<string, unknown> = {};
  if (filters.paymentStatus) filter.paymentStatus = filters.paymentStatus;
  if (filters.fulfillmentStatus) filter.fulfillmentStatus = filters.fulfillmentStatus;
  if (filters.customerEmail) {
    const user = await UserModel.findOne({ email: filters.customerEmail.toLowerCase() }).select('_id');
    filter.customerId = user?._id ?? null;
  }
  const skip = (page - 1) * pageSize;
  const [orders, totalItems] = await Promise.all([
    OrderModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
    OrderModel.countDocuments(filter)
  ]);
  return { orders, totalItems };
}

/** How an admin discovers a `paymentAttemptId` to pass to `processRefund` — there is no other way to look one up from the UI. */
export async function listPaymentAttemptsForOrder(orderId: string) {
  return PaymentAttemptModel.find({ orderId }).sort({ createdAt: -1 });
}

export async function listReturnRequests(page: number, pageSize: number, status?: string) {
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  const skip = (page - 1) * pageSize;
  const [returns, totalItems] = await Promise.all([
    ReturnRequestModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
    ReturnRequestModel.countDocuments(filter)
  ]);
  return { returns, totalItems };
}

export async function reviewReturnRequest(
  ctx: AdminActorContext,
  returnId: string,
  decision: 'approved' | 'rejected',
  approvedAmount?: { amountMinor: number; currency: string },
  note?: string
) {
  const returnRequest = await ReturnRequestModel.findById(returnId);
  if (!returnRequest) throw new NotFoundError('Return request not found');
  if (returnRequest.status !== 'requested') {
    throw new ConflictError('INVALID_STATUS_TRANSITION', 'Only a requested return can be reviewed');
  }

  const before = { status: returnRequest.status };
  returnRequest.status = decision;
  if (decision === 'approved' && approvedAmount) returnRequest.approvedAmount = approvedAmount;
  returnRequest.statusHistory.push({ status: decision, changedAt: new Date(), changedBy: ctx.actorUserId, note });
  await returnRequest.save();

  if (decision === 'approved') {
    await transitionFulfillmentStatus(returnRequest.orderId.toString(), 'returned', { changedBy: ctx.actorUserId, note: 'Return approved' });
  }

  await audit(ctx, 'return.review', 'ReturnRequest', returnId, before, { status: decision, note });
  return returnRequest;
}

export async function processRefund(
  ctx: AdminActorContext,
  input: { paymentAttemptId: string; returnRequestId?: string; requestedAmount: { amountMinor: number; currency: string }; reason?: string }
) {
  const paymentAttempt = await PaymentAttemptModel.findById(input.paymentAttemptId);
  if (!paymentAttempt) throw new NotFoundError('Payment attempt not found');

  const refund = await issueRefund({ orderId: paymentAttempt.orderId.toString(), ...input });
  await audit(ctx, 'refund.process', 'Refund', refund._id.toString(), undefined, input);
  return refund;
}

export async function moderateReview(ctx: AdminActorContext, reviewId: string, status: 'approved' | 'rejected', note?: string) {
  const review = await ReviewModel.findById(reviewId);
  if (!review) throw new NotFoundError('Review not found');
  if (review.moderationStatus === status) {
    throw new UnprocessableError('ALREADY_IN_STATE', `Review is already ${status}`);
  }

  const wasApproved = review.moderationStatus === 'approved';
  review.moderationStatus = status;
  if (note) review.moderationNote = note;
  await review.save();

  if (status === 'approved' && !wasApproved) {
    await applyRatingDelta(review.productId.toString(), review.rating, 1);
  } else if (status !== 'approved' && wasApproved) {
    await applyRatingDelta(review.productId.toString(), review.rating, -1);
  }

  await audit(ctx, 'review.moderate', 'Review', reviewId, undefined, { status, note });
  return review;
}

export async function createCoupon(ctx: AdminActorContext, input: Record<string, unknown>) {
  const coupon = await CouponModel.create(input);
  await audit(ctx, 'coupon.create', 'Coupon', coupon._id.toString(), undefined, input);
  return coupon;
}

export async function listCoupons(page: number, pageSize: number) {
  const skip = (page - 1) * pageSize;
  const [coupons, totalItems] = await Promise.all([
    CouponModel.find().sort({ createdAt: -1 }).skip(skip).limit(pageSize),
    CouponModel.countDocuments()
  ]);
  return { coupons, totalItems };
}

export async function getAuditLogsForResource(resourceType: string, resourceId: string, page: number, pageSize: number) {
  return listAuditLogsForResource(resourceType, resourceId, page, pageSize);
}

export async function listRecentAuditLogs(page: number, pageSize: number) {
  const skip = (page - 1) * pageSize;
  const [logs, totalItems] = await Promise.all([
    AuditLogModel.find().sort({ createdAt: -1 }).skip(skip).limit(pageSize),
    AuditLogModel.countDocuments()
  ]);
  return { logs, totalItems };
}

export async function getAnalytics(rangeDays: number) {
  return getAnalyticsOverview(rangeDays);
}

export async function getUserDetail(userId: string) {
  const user = await UserModel.findById(userId);
  if (!user) throw new NotFoundError('User not found');
  const orderCount = await OrderModel.countDocuments({ customerId: userId });
  return { user, orderCount };
}

export async function getSellerDetail(sellerId: string) {
  const seller = await SellerModel.findById(sellerId);
  if (!seller) throw new NotFoundError('Seller not found');
  const [productCount, orderCount] = await Promise.all([
    ProductModel.countDocuments({ sellerId }),
    OrderModel.countDocuments({ sellerIds: sellerId })
  ]);
  return { seller, productCount, orderCount };
}

/** `apiKeyConfigured` — never the key itself — is the only secret-related detail this ever returns (security.md). */
export async function getAiOverview() {
  const env = getEnv();
  const [byPurpose, totalConversations, totalMessages, activeConversations] = await Promise.all([
    AiConversationModel.aggregate([{ $group: { _id: '$purpose', count: { $sum: 1 } } }]),
    AiConversationModel.countDocuments({}),
    AiMessageModel.countDocuments({}),
    AiConversationModel.countDocuments({ deletedAt: { $exists: false } })
  ]);

  const conversationsByPurpose: Record<string, number> = {};
  for (const row of byPurpose as Array<{ _id: string; count: number }>) conversationsByPurpose[row._id] = row.count;

  return {
    provider: env.AI_PROVIDER,
    // AI_MODEL is unset-or-blank in every dev/test .env (not a secret, so it skips the blankable() treatment env.ts
    // gives actual secrets) — `?? null` alone wouldn't catch the blank-string case, only a true `undefined`.
    model: env.AI_MODEL || null,
    apiKeyConfigured: Boolean(env.AI_API_KEY),
    totalConversations,
    activeConversations,
    totalMessages,
    conversationsByPurpose
  };
}

export async function listAiConversations(page: number, pageSize: number) {
  const skip = (page - 1) * pageSize;
  const [conversations, totalItems] = await Promise.all([
    AiConversationModel.find().sort({ createdAt: -1 }).skip(skip).limit(pageSize),
    AiConversationModel.countDocuments()
  ]);
  const counts = await AiMessageModel.aggregate([
    { $match: { conversationId: { $in: conversations.map((c) => c._id) } } },
    { $group: { _id: '$conversationId', count: { $sum: 1 } } }
  ]);
  const countByConversation = new Map(counts.map((c: { _id: Types.ObjectId; count: number }) => [c._id.toString(), c.count]));
  return { conversations, totalItems, countByConversation };
}

/** The one place raw AI message content leaves the server to an admin — deliberately a single-resource drill-in, never bundled into the list above, and itself audit-logged since it exposes user content. */
export async function getAiConversationDetail(ctx: AdminActorContext, conversationId: string) {
  const conversation = await AiConversationModel.findById(conversationId);
  if (!conversation) throw new NotFoundError('Conversation not found');
  const messages = await AiMessageModel.find({ conversationId: conversation._id }).sort({ createdAt: 1 });
  await audit(ctx, 'ai_conversation.view', 'AIConversation', conversationId);
  return { conversation, messages };
}
