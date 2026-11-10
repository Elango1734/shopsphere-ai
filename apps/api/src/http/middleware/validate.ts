import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { ValidationError } from '../errors.js';

type Source = 'body' | 'query' | 'params';

function toDetails(error: import('zod').ZodError) {
  return error.issues.map((issue) => ({ code: 'INVALID_FORMAT', message: issue.message, field: issue.path.join('.') }));
}

/**
 * Parses and replaces `req[source]` with the schema's validated/coerced
 * output. Controllers only ever read the validated value, never the raw
 * request object — this is the server-side validation api-specification.md
 * and security.md both require regardless of what a client (or
 * `packages/validation`-sharing frontend) already checked.
 *
 * Express 5 made `req.query` a getter defined on the request prototype that
 * recomputes a brand-new object from the raw URL on every single access —
 * it is never cached. Mutating the object `req.query` returns does nothing
 * for later reads (including the controller's), since each read discards it
 * and reparses the querystring from scratch. The getter is `configurable`,
 * so the fix is to shadow it with an own data property on this specific
 * `req` instance via `Object.defineProperty`, which later reads of
 * `req.query` on this request will see instead of the prototype getter.
 */
export function validate(source: Source, schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(new ValidationError(toDetails(result.error)));
      return;
    }

    if (source === 'query') {
      Object.defineProperty(req, 'query', {
        value: result.data,
        writable: true,
        configurable: true,
        enumerable: true
      });
    } else {
      req[source] = result.data;
    }
    next();
  };
}
