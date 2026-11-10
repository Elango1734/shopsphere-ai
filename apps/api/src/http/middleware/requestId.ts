import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const HEADER = 'x-request-id';

/** Every response carries a server-generated request ID, trusting an inbound one only as a correlation hint. */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const inbound = req.header(HEADER);
  req.id = inbound && inbound.length <= 100 ? inbound : `req_${randomUUID()}`;
  res.setHeader('X-Request-Id', req.id);
  next();
}
