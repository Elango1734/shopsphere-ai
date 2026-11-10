import { NotificationModel } from '../../models/notification.model.js';
import { NotFoundError } from '../../http/errors.js';

export async function listMyNotifications(userId: string, page: number, pageSize: number, unreadOnly?: boolean) {
  const filter: Record<string, unknown> = { userId };
  if (unreadOnly) filter.readAt = { $exists: false };
  const skip = (page - 1) * pageSize;
  const [notifications, totalItems] = await Promise.all([
    NotificationModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
    NotificationModel.countDocuments(filter)
  ]);
  return { notifications, totalItems };
}

export async function markRead(userId: string, notificationId: string) {
  const notification = await NotificationModel.findOneAndUpdate(
    { _id: notificationId, userId },
    { $set: { readAt: new Date() } },
    { new: true }
  );
  if (!notification) throw new NotFoundError('Notification not found');
  return notification;
}

export async function markAllRead(userId: string): Promise<number> {
  const result = await NotificationModel.updateMany({ userId, readAt: { $exists: false } }, { $set: { readAt: new Date() } });
  return result.modifiedCount;
}
