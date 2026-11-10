import type { Request, Response } from 'express';
import type { AddCartItemInput } from '@shopsphere/validation';
import { sendSuccess } from '../../http/envelope.js';
import * as service from './cart.service.js';
import { toCartDto } from './cart.dto.js';
import { reqParam } from '../../http/reqParam.js';

function ownerOf(req: Request): service.CartOwner {
  return req.auth?.userId ? { userId: req.auth.userId } : { guestToken: req.guestToken };
}

export async function getCartHandler(req: Request, res: Response): Promise<void> {
  const cart = await service.getRevalidatedCart(ownerOf(req));
  sendSuccess(res, toCartDto(cart));
}

export async function addItemHandler(req: Request, res: Response): Promise<void> {
  const { variantId, quantity } = req.body as AddCartItemInput;
  const cart = await service.addVariantToCart(ownerOf(req), variantId, quantity);
  sendSuccess(res, toCartDto(cart), { status: 201 });
}

export async function updateItemHandler(req: Request, res: Response): Promise<void> {
  const { quantity } = req.body as { quantity: number };
  const cart = await service.updateCartItem(ownerOf(req), reqParam(req, 'variantId'), quantity);
  sendSuccess(res, toCartDto(cart));
}

export async function removeItemHandler(req: Request, res: Response): Promise<void> {
  const cart = await service.updateCartItem(ownerOf(req), reqParam(req, 'variantId'), 0);
  sendSuccess(res, toCartDto(cart));
}
