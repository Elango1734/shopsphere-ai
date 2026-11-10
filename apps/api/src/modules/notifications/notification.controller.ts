import type { Request, Response } from 'express';
import { sendSuccess, sendPaginated } from '../../http/envelope.js';
import { reqParam } from '../../http/reqParam.js';
import * as service from './notification.service.js';
import { toPublicId } from '../../utils/ids.js';

function toNotificationDto(n: Awaited<ReturnType<typeof service.listMyNotifications>>['notifications'][number]) {
  return {
    id: toPublicId(n._id),
    type: n.type,
    channel: n.channel,
    title: n.title,
    body: n.body,
    data: n.data,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString()
  };
}

export async function listHandler(req: Request, res: Response): Promise<void> {
  const { page, pageSize, unreadOnly } = req.query as unknown as { page: number; pageSize: number; unreadOnly?: boolean };
  const { notifications, totalItems } = await service.listMyNotifications(req.auth!.userId, page, pageSize, unreadOnly);
  sendPaginated(res, notifications.map(toNotificationDto), { page, pageSize, totalItems });
}

export async function markReadHandler(req: Request, res: Response): Promise<void> {
  const notification = await service.markRead(req.auth!.userId, reqParam(req, 'notificationId'));
  sendSuccess(res, toNotificationDto(notification));
}

export async function markAllReadHandler(req: Request, res: Response): Promise<void> {
  const count = await service.markAllRead(req.auth!.userId);
  sendSuccess(res, { markedRead: count });
}
