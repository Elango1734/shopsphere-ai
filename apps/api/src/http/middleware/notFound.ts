import type { Request, Response } from 'express';
import { sendError } from '../envelope.js';

export function notFoundMiddleware(req: Request, res: Response): void {
  sendError(res, 404, 'NOT_FOUND', `No route for ${req.method} ${req.path}`);
}
