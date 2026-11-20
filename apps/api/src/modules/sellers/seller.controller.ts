import type { Request, Response } from 'express';
import { sendSuccess, sendPaginated } from '../../http/envelope.js';
import { reqParam } from '../../http/reqParam.js';
import * as service from './seller.service.js';
import { getSellerDailyReport } from '../ai/insights.service.js';
import { toSellerDto, toSellerProductDto, toSellerVariantDto } from './seller.dto.js';
import { toOrderSummaryDto, toOrderDetailDto, toShipmentDto } from '../orders/order.dto.js';
import { OrderModel } from '../../models/order.model.js';
import { NotFoundError } from '../../http/errors.js';
import type { FulfillmentStatus } from '@shopsphere/shared-types';

export async function onboardHandler(req: Request, res: Response): Promise<void> {
  const seller = await service.onboardSeller(req.auth!.userId, req.body);
  sendSuccess(res, toSellerDto(seller), { status: 201 });
}

export async function getMySellerHandler(req: Request, res: Response): Promise<void> {
  const seller = await service.getMySeller(req.auth!.userId);
  sendSuccess(res, toSellerDto(seller));
}

export async function createProductHandler(req: Request, res: Response): Promise<void> {
  const product = await service.createProduct(req.auth!.userId, req.body);
  sendSuccess(res, toSellerProductDto(product), { status: 201 });
}

export async function updateProductHandler(req: Request, res: Response): Promise<void> {
  const product = await service.updateProduct(req.auth!.userId, reqParam(req, 'productId'), req.body);
  sendSuccess(res, toSellerProductDto(product));
}

export async function submitProductHandler(req: Request, res: Response): Promise<void> {
  const product = await service.submitProductForReview(req.auth!.userId, reqParam(req, 'productId'));
  sendSuccess(res, toSellerProductDto(product));
}

export async function listMyProductsHandler(req: Request, res: Response): Promise<void> {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const { products, totalItems } = await service.listMyProducts(req.auth!.userId, page, pageSize);
  sendPaginated(res, products.map(toSellerProductDto), { page, pageSize, totalItems });
}

export async function createVariantHandler(req: Request, res: Response): Promise<void> {
  const { variant, inventory } = await service.createVariant(req.auth!.userId, reqParam(req, 'productId'), req.body);
  sendSuccess(res, toSellerVariantDto(variant, inventory), { status: 201 });
}

export async function updateVariantHandler(req: Request, res: Response): Promise<void> {
  const variant = await service.updateVariant(req.auth!.userId, reqParam(req, 'variantId'), req.body);
  sendSuccess(res, toSellerVariantDto(variant));
}

export async function listVariantsHandler(req: Request, res: Response): Promise<void> {
  const results = await service.listVariantsForProduct(req.auth!.userId, reqParam(req, 'productId'));
  sendSuccess(res, results.map(({ variant, inventory }) => toSellerVariantDto(variant, inventory)));
}

export async function updateInventoryHandler(req: Request, res: Response): Promise<void> {
  const { onHand, lowStockThreshold } = req.body as { onHand: number; lowStockThreshold?: number };
  await service.updateInventory(req.auth!.userId, reqParam(req, 'variantId'), onHand, lowStockThreshold);
  sendSuccess(res, { updated: true });
}

export async function lowStockHandler(req: Request, res: Response): Promise<void> {
  const items = await service.listLowStockVariants(req.auth!.userId);
  sendSuccess(
    res,
    items.map((i) => ({ variantId: i.variantId.toString(), onHand: i.onHand, reserved: i.reserved, available: i.onHand - i.reserved, lowStockThreshold: i.lowStockThreshold }))
  );
}

export async function listSellerOrdersHandler(req: Request, res: Response): Promise<void> {
  const { page, pageSize, fulfillmentStatus } = req.query as unknown as { page: number; pageSize: number; fulfillmentStatus?: FulfillmentStatus };
  const { orders, totalItems } = await service.listSellerOrdersForUser(req.auth!.userId, page, pageSize, fulfillmentStatus);
  sendPaginated(res, orders.map(toOrderSummaryDto), { page, pageSize, totalItems });
}

export async function getSellerOrderHandler(req: Request, res: Response): Promise<void> {
  const seller = await service.getMySeller(req.auth!.userId);
  const order = await OrderModel.findOne({ _id: reqParam(req, 'orderId'), sellerIds: seller._id });
  if (!order) throw new NotFoundError('Order not found for this seller');
  sendSuccess(res, toOrderDetailDto(order));
}

export async function updateFulfillmentHandler(req: Request, res: Response): Promise<void> {
  const { status, note } = req.body as { status: FulfillmentStatus; note?: string };
  const order = await service.updateOrderFulfillmentForSeller(req.auth!.userId, reqParam(req, 'orderId'), status, note);
  sendSuccess(res, toOrderDetailDto(order));
}

export async function createShipmentHandler(req: Request, res: Response): Promise<void> {
  const shipment = await service.createShipmentForSeller(req.auth!.userId, reqParam(req, 'orderId'), req.body);
  sendSuccess(res, toShipmentDto(shipment), { status: 201 });
}

export async function getMyAnalyticsHandler(req: Request, res: Response): Promise<void> {
  const { rangeDays } = req.query as unknown as { rangeDays: number };
  const overview = await service.getMyAnalytics(req.auth!.userId, rangeDays);
  sendSuccess(res, overview);
}

export async function getMyDailyReportHandler(req: Request, res: Response): Promise<void> {
  const date = typeof req.query.date === 'string' ? req.query.date : undefined;
  const report = await getSellerDailyReport(req.auth!.userId, date);
  sendSuccess(res, report);
}
