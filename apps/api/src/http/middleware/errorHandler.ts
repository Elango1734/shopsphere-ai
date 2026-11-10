import type { NextFunction, Request, Response } from 'express';
import { mapKnownError } from '../mapKnownError.js';
import { sendError } from '../envelope.js';

/**
 * The single place that turns any thrown error into the API's error
 * envelope. Unmapped errors become a generic 500 with no leaked stack trace,
 * message detail, or internal identifiers — api-specification.md forbids
 * disclosing that to clients — while the full error is still logged
 * server-side against the request ID for debugging.
 */
export function errorHandlerMiddleware(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  const mapped = mapKnownError(error);

  if (mapped) {
    if (mapped.status >= 500) {
      req.log.error({ err: error, requestId: req.id }, 'Unhandled error mapped to 5xx');
    }
    sendError(res, mapped.status, mapped.code, mapped.message, mapped.details);
    return;
  }

  req.log.error({ err: error, requestId: req.id }, 'Unexpected error');
  sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
}
