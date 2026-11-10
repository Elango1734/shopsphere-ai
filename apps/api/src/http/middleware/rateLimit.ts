import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { sendError } from '../envelope.js';
import { isDevelopmentOrTest } from '../../config/env.js';

/**
 * Rate limits are disabled under test (deterministic Supertest runs must not
 * flake on a shared counter) but active in development so the behavior is
 * still exercisable manually. security.md requires limiting auth, search,
 * AI, checkout, and upload routes specifically "according to risk" — the
 * presets below give each of those groups its own budget rather than one
 * global limiter, so a burst of catalog browsing can't lock out checkout.
 */
function makeLimiter(windowMs: number, max: number, code: string) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isDevelopmentOrTest() && process.env.RATE_LIMIT_FORCE !== '1',
    keyGenerator: (req: Request) => req.auth?.userId ?? req.ip ?? 'unknown',
    handler: (req, res) => {
      sendError(res, 429, code, 'Too many requests, please try again later');
    }
  });
}

export const authRateLimiter = makeLimiter(15 * 60 * 1000, 20, 'AUTH_RATE_LIMITED');
export const searchRateLimiter = makeLimiter(60 * 1000, 60, 'SEARCH_RATE_LIMITED');
export const aiRateLimiter = makeLimiter(60 * 1000, 20, 'AI_RATE_LIMITED');
export const checkoutRateLimiter = makeLimiter(60 * 1000, 10, 'CHECKOUT_RATE_LIMITED');
export const mutationRateLimiter = makeLimiter(60 * 1000, 120, 'RATE_LIMITED');
