import { createHmac, timingSafeEqual } from 'node:crypto';
import { getEnv } from '../../config/env.js';

/**
 * Verifies against the EXACT raw request body bytes (security.md), not a
 * re-serialized JSON object — re-serialization can silently change byte
 * content (key order, whitespace, number formatting) and invalidate a
 * signature that was actually valid, or worse, validate a tampered payload
 * whose re-serialization happens to match.
 */
export function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!signatureHeader) return false;
  const [scheme, provided] = signatureHeader.split('=');
  if (scheme !== 'sha256' || !provided) return false;

  const expected = createHmac('sha256', getEnv().PAYMENT_WEBHOOK_SECRET).update(rawBody).digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  const providedBuf = Buffer.from(provided, 'hex');
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

export function signWebhookPayload(rawBody: Buffer): string {
  const hmac = createHmac('sha256', getEnv().PAYMENT_WEBHOOK_SECRET).update(rawBody).digest('hex');
  return `sha256=${hmac}`;
}
