import type { Request, Response } from 'express';
import { sendSuccess } from '../../http/envelope.js';
import { reqParam } from '../../http/reqParam.js';
import { processPaymentWebhook } from './webhook.service.js';

export async function paymentWebhookHandler(req: Request, res: Response): Promise<void> {
  const provider = reqParam(req, 'provider');
  const signature = req.header('x-shopsphere-signature');
  const rawBody = req.body as Buffer;

  const result = await processPaymentWebhook(provider, rawBody, signature);
  sendSuccess(res, result);
}
