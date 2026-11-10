import type { NextFunction, Request, Response } from 'express';
import { ValidationError } from '../errors.js';

/**
 * Defense-in-depth against NoSQL injection (security.md: "Reject MongoDB
 * operators and unsafe key paths; never pass request objects directly into
 * Mongoose filters or updates"). Every route additionally validates with a
 * Zod schema that only recognizes known keys, so this should never actually
 * fire in practice — it exists for any route that forgets to.
 */
export function sanitizeInputMiddleware(req: Request, _res: Response, next: NextFunction): void {
  for (const source of [req.body, req.query, req.params] as unknown[]) {
    if (containsUnsafeKey(source)) {
      next(new ValidationError([{ code: 'UNSAFE_INPUT', message: 'Request contains disallowed keys' }]));
      return;
    }
  }
  next();
}

function containsUnsafeKey(value: unknown, depth = 0): boolean {
  if (depth > 10 || value === null || typeof value !== 'object') return false;

  if (Array.isArray(value)) {
    return value.some((item) => containsUnsafeKey(item, depth + 1));
  }

  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (key.startsWith('$') || key.includes('.')) return true;
    if (containsUnsafeKey((value as Record<string, unknown>)[key], depth + 1)) return true;
  }
  return false;
}
