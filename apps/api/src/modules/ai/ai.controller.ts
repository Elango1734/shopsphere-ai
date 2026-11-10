import type { Request, Response } from 'express';
import { sendSuccess } from '../../http/envelope.js';
import { reqParam } from '../../http/reqParam.js';
import { hashGuestToken } from '../../repositories/cart.repository.js';
import * as service from './ai.service.js';

function ownerOf(req: Request): service.OwnerKey {
  return req.auth?.userId ? { userId: req.auth.userId } : { guestTokenHash: hashGuestToken(req.guestToken) };
}

export async function discoveryHandler(req: Request, res: Response): Promise<void> {
  const { message, conversationId } = req.body as { message: string; conversationId?: string };
  const result = await service.discover(ownerOf(req), message, conversationId);
  sendSuccess(res, result);
}

export async function compareHandler(req: Request, res: Response): Promise<void> {
  const { productIds, conversationId } = req.body as { productIds: string[]; conversationId?: string };
  const result = await service.compare(ownerOf(req), productIds, conversationId);
  sendSuccess(res, result);
}

export async function supportHandler(req: Request, res: Response): Promise<void> {
  const { message, orderId, conversationId } = req.body as { message: string; orderId?: string; conversationId?: string };
  const result = await service.support(ownerOf(req), message, orderId, conversationId);
  sendSuccess(res, result);
}

export async function getHistoryHandler(req: Request, res: Response): Promise<void> {
  const messages = await service.getConversationHistory(ownerOf(req), reqParam(req, 'conversationId'));
  sendSuccess(
    res,
    messages.map((m) => ({ role: m.role, content: m.content, groundedProductIds: m.groundedProductIds.map((id) => id.toString()), createdAt: m.createdAt.toISOString() }))
  );
}

export async function deleteHistoryHandler(req: Request, res: Response): Promise<void> {
  await service.deleteConversation(ownerOf(req), reqParam(req, 'conversationId'));
  sendSuccess(res, { deleted: true });
}

export async function relatedProductsHandler(req: Request, res: Response): Promise<void> {
  const products = await service.getRelatedProducts(reqParam(req, 'slug'));
  sendSuccess(res, products);
}

export async function reviewSummaryHandler(req: Request, res: Response): Promise<void> {
  const summary = await service.summarizeReviews(reqParam(req, 'slug'));
  sendSuccess(res, summary);
}
