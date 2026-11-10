import type { Request, Response } from 'express';
import { sendSuccess, sendPaginated } from '../../http/envelope.js';
import { reqParam } from '../../http/reqParam.js';
import * as service from './order.service.js';
import { toOrderSummaryDto, toOrderDetailDto, toShipmentDto, toReturnRequestDto } from './order.dto.js';

export async function listOrdersHandler(req: Request, res: Response): Promise<void> {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const { orders, totalItems } = await service.listMyOrders(req.auth!.userId, page, pageSize);
  sendPaginated(res, orders.map(toOrderSummaryDto), { page, pageSize, totalItems });
}

export async function getOrderHandler(req: Request, res: Response): Promise<void> {
  const order = await service.getOwnedOrder(req.auth!.userId, reqParam(req, 'orderId'));
  sendSuccess(res, toOrderDetailDto(order));
}

export async function cancelOrderHandler(req: Request, res: Response): Promise<void> {
  const { reason } = req.body as { reason?: string };
  const order = await service.cancelOwnedOrder(req.auth!.userId, reqParam(req, 'orderId'), reason);
  sendSuccess(res, toOrderDetailDto(order));
}

export async function listOrderShipmentsHandler(req: Request, res: Response): Promise<void> {
  const shipments = await service.listShipmentsForOrder(req.auth!.userId, reqParam(req, 'orderId'));
  sendSuccess(res, shipments.map(toShipmentDto));
}

export async function createReturnHandler(req: Request, res: Response): Promise<void> {
  const returnRequest = await service.createReturnRequest(req.auth!.userId, req.body as service.CreateReturnInput);
  sendSuccess(res, toReturnRequestDto(returnRequest), { status: 201 });
}

export async function listReturnsHandler(req: Request, res: Response): Promise<void> {
  const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
  const { returns, totalItems } = await service.listMyReturnRequests(req.auth!.userId, page, pageSize);
  sendPaginated(res, returns.map(toReturnRequestDto), { page, pageSize, totalItems });
}

export async function getReturnHandler(req: Request, res: Response): Promise<void> {
  const returnRequest = await service.getOwnedReturnRequest(req.auth!.userId, reqParam(req, 'returnId'));
  sendSuccess(res, toReturnRequestDto(returnRequest));
}
