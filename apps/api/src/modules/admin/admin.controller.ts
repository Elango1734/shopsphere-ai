import type { Request, Response } from 'express';
import type { UserRole, SellerStatus } from '@shopsphere/shared-types';
import { sendSuccess, sendPaginated } from '../../http/envelope.js';
import { reqParam } from '../../http/reqParam.js';
import * as service from './admin.service.js';
import { toCouponDto, toAuditLogDto, toAiConversationSummaryDto, toAiMessageDto, toAdminProductDto, toPaymentAttemptDto } from './admin.dto.js';
import { toUserDto } from '../auth/dto.js';
import { toSellerDto } from '../sellers/seller.dto.js';
import { toCategoryDto, toBrandDto } from '../catalog/catalog.dto.js';
import { toOrderSummaryDto, toOrderDetailDto, toReturnRequestDto } from '../orders/order.dto.js';
import { toReviewDto } from '../reviews/review.dto.js';
import { OrderModel } from '../../models/order.model.js';
import { NotFoundError } from '../../http/errors.js';

function ctx(req: Request) {
  return { actorUserId: req.auth!.userId, requestId: req.id };
}

function pageParams(req: Request) {
  return req.query as unknown as { page: number; pageSize: number };
}

export async function listUsersHandler(req: Request, res: Response): Promise<void> {
  const { page, pageSize } = pageParams(req);
  const { role, status } = req.query as unknown as { role?: UserRole; status?: string };
  const { users, totalItems } = await service.listUsers(page, pageSize, role, status);
  sendPaginated(res, users.map(toUserDto), { page, pageSize, totalItems });
}

export async function changeUserStatusHandler(req: Request, res: Response): Promise<void> {
  const { status, note } = req.body as { status: 'active' | 'suspended'; note?: string };
  const user = await service.changeUserStatus(ctx(req), reqParam(req, 'userId'), status, note);
  sendSuccess(res, toUserDto(user));
}

export async function listSellersHandler(req: Request, res: Response): Promise<void> {
  const { page, pageSize } = pageParams(req);
  const { status } = req.query as unknown as { status?: SellerStatus };
  const { sellers, totalItems } = await service.listSellers(page, pageSize, status);
  sendPaginated(res, sellers.map(toSellerDto), { page, pageSize, totalItems });
}

export async function changeSellerStatusHandler(req: Request, res: Response): Promise<void> {
  const { status, note } = req.body as { status: SellerStatus; note?: string };
  const seller = await service.changeSellerStatus(ctx(req), reqParam(req, 'sellerId'), status, note);
  sendSuccess(res, toSellerDto(seller));
}

export async function createCategoryHandler(req: Request, res: Response): Promise<void> {
  const category = await service.createCategory(ctx(req), req.body);
  sendSuccess(res, toCategoryDto(category), { status: 201 });
}

export async function createBrandHandler(req: Request, res: Response): Promise<void> {
  const brand = await service.createBrand(ctx(req), req.body);
  sendSuccess(res, toBrandDto(brand), { status: 201 });
}

export async function listProductsHandler(req: Request, res: Response): Promise<void> {
  const { page, pageSize } = pageParams(req);
  const { moderationStatus, categoryId, sellerId } = req.query as unknown as {
    moderationStatus?: string;
    categoryId?: string;
    sellerId?: string;
  };
  const { products, totalItems } = await service.listProductsForModeration(page, pageSize, {
    ...(moderationStatus ? { moderationStatus } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(sellerId ? { sellerId } : {})
  });
  sendPaginated(res, products.map(toAdminProductDto), { page, pageSize, totalItems });
}

export async function moderateProductHandler(req: Request, res: Response): Promise<void> {
  const { status, note } = req.body as { status: 'published' | 'rejected' | 'archived'; note?: string };
  const product = await service.moderateProduct(ctx(req), reqParam(req, 'productId'), status, note);
  sendSuccess(res, toAdminProductDto(product));
}

export async function searchOrdersHandler(req: Request, res: Response): Promise<void> {
  const { page, pageSize } = pageParams(req);
  const { paymentStatus, fulfillmentStatus, customerEmail } = req.query as unknown as {
    paymentStatus?: string;
    fulfillmentStatus?: string;
    customerEmail?: string;
  };
  const { orders, totalItems } = await service.searchOrders(page, pageSize, {
    ...(paymentStatus ? { paymentStatus } : {}),
    ...(fulfillmentStatus ? { fulfillmentStatus } : {}),
    ...(customerEmail ? { customerEmail } : {})
  });
  sendPaginated(res, orders.map(toOrderSummaryDto), { page, pageSize, totalItems });
}

export async function getOrderHandler(req: Request, res: Response): Promise<void> {
  const order = await OrderModel.findById(reqParam(req, 'orderId'));
  if (!order) throw new NotFoundError('Order not found');
  sendSuccess(res, toOrderDetailDto(order));
}

export async function listPaymentAttemptsHandler(req: Request, res: Response): Promise<void> {
  const attempts = await service.listPaymentAttemptsForOrder(reqParam(req, 'orderId'));
  sendSuccess(res, attempts.map(toPaymentAttemptDto));
}

export async function listReturnsHandler(req: Request, res: Response): Promise<void> {
  const { page, pageSize } = pageParams(req);
  const { status } = req.query as unknown as { status?: string };
  const { returns, totalItems } = await service.listReturnRequests(page, pageSize, status);
  sendPaginated(res, returns.map(toReturnRequestDto), { page, pageSize, totalItems });
}

export async function reviewReturnHandler(req: Request, res: Response): Promise<void> {
  const { decision, approvedAmount, note } = req.body as {
    decision: 'approved' | 'rejected';
    approvedAmount?: { amountMinor: number; currency: string };
    note?: string;
  };
  const returnRequest = await service.reviewReturnRequest(ctx(req), reqParam(req, 'returnId'), decision, approvedAmount, note);
  sendSuccess(res, toReturnRequestDto(returnRequest));
}

export async function processRefundHandler(req: Request, res: Response): Promise<void> {
  const refund = await service.processRefund(ctx(req), req.body);
  sendSuccess(res, { id: refund._id.toString(), status: refund.status }, { status: 201 });
}

export async function moderateReviewHandler(req: Request, res: Response): Promise<void> {
  const { status, note } = req.body as { status: 'approved' | 'rejected'; note?: string };
  const review = await service.moderateReview(ctx(req), reqParam(req, 'reviewId'), status, note);
  sendSuccess(res, toReviewDto(review));
}

export async function createCouponHandler(req: Request, res: Response): Promise<void> {
  const coupon = await service.createCoupon(ctx(req), req.body);
  sendSuccess(res, toCouponDto(coupon), { status: 201 });
}

export async function listCouponsHandler(req: Request, res: Response): Promise<void> {
  const { page, pageSize } = pageParams(req);
  const { coupons, totalItems } = await service.listCoupons(page, pageSize);
  sendPaginated(res, coupons.map(toCouponDto), { page, pageSize, totalItems });
}

export async function listAuditLogsHandler(req: Request, res: Response): Promise<void> {
  const { page, pageSize } = pageParams(req);
  const { logs, totalItems } = await service.listRecentAuditLogs(page, pageSize);
  sendPaginated(res, logs.map(toAuditLogDto), { page, pageSize, totalItems });
}

export async function getAnalyticsHandler(req: Request, res: Response): Promise<void> {
  const { rangeDays } = req.query as unknown as { rangeDays: number };
  const overview = await service.getAnalytics(rangeDays);
  sendSuccess(res, overview);
}

export async function getUserHandler(req: Request, res: Response): Promise<void> {
  const { user, orderCount } = await service.getUserDetail(reqParam(req, 'userId'));
  sendSuccess(res, { ...toUserDto(user), orderCount });
}

export async function getSellerHandler(req: Request, res: Response): Promise<void> {
  const { seller, productCount, orderCount } = await service.getSellerDetail(reqParam(req, 'sellerId'));
  sendSuccess(res, { ...toSellerDto(seller), productCount, orderCount });
}

export async function getAiOverviewHandler(_req: Request, res: Response): Promise<void> {
  const overview = await service.getAiOverview();
  sendSuccess(res, overview);
}

export async function listAiConversationsHandler(req: Request, res: Response): Promise<void> {
  const { page, pageSize } = pageParams(req);
  const { conversations, totalItems, countByConversation } = await service.listAiConversations(page, pageSize);
  sendPaginated(
    res,
    conversations.map((c) => toAiConversationSummaryDto(c, countByConversation.get(c._id.toString()) ?? 0)),
    { page, pageSize, totalItems }
  );
}

export async function getAiConversationHandler(req: Request, res: Response): Promise<void> {
  const { conversation, messages } = await service.getAiConversationDetail(ctx(req), reqParam(req, 'conversationId'));
  sendSuccess(res, { ...toAiConversationSummaryDto(conversation, messages.length), messages: messages.map(toAiMessageDto) });
}
