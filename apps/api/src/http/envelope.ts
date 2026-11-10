import type { Response } from 'express';
import type { ApiErrorDetail } from '@shopsphere/shared-types';

declare module 'express-serve-static-core' {
  interface Request {
    id: string;
  }
}

/** Every success response shares this shape; `meta` is always present (empty object when there is none). */
export function sendSuccess<TData>(
  res: Response,
  data: TData,
  options: { meta?: Record<string, unknown>; status?: number } = {}
): void {
  res.status(options.status ?? 200).json({
    success: true,
    data,
    meta: options.meta ?? {},
    requestId: res.req.id
  });
}

export function sendPaginated<TItem>(
  res: Response,
  items: TItem[],
  pagination: { page: number; pageSize: number; totalItems: number },
  status = 200
): void {
  const totalPages = Math.max(1, Math.ceil(pagination.totalItems / pagination.pageSize));
  sendSuccess(res, items, { status, meta: { pagination: { ...pagination, totalPages } } });
}

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details: ApiErrorDetail[] = []
): void {
  res.status(status).json({
    success: false,
    error: { code, message, details },
    requestId: res.req.id
  });
}
