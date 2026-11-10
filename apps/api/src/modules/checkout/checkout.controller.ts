import type { Request, Response } from 'express';
import type { CheckoutInput } from '@shopsphere/validation';
import { sendSuccess } from '../../http/envelope.js';
import { ValidationError } from '../../http/errors.js';
import * as checkoutService from './checkout.service.js';

function requireIdempotencyKey(req: Request): string {
  const key = req.header('idempotency-key');
  if (!key || key.length < 8 || key.length > 200) {
    throw new ValidationError([{ code: 'MISSING_IDEMPOTENCY_KEY', message: 'An Idempotency-Key header is required', field: 'idempotency-key' }]);
  }
  return key;
}

export async function checkoutHandler(req: Request, res: Response): Promise<void> {
  const idempotencyKey = requireIdempotencyKey(req);
  const result = await checkoutService.checkout(req.auth!.userId, idempotencyKey, req.body as CheckoutInput);
  sendSuccess(res, result, { status: 201 });
}
