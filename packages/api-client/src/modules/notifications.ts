import type { ApiClient } from '../core.js';
import type { NotificationDto, PaginationMeta } from '../types.js';

export function createNotificationsModule(client: ApiClient) {
  return {
    list: (page = 1, pageSize = 20, unreadOnly?: boolean) =>
      client.requestWithMeta<NotificationDto[], { pagination: PaginationMeta }>('GET', '/notifications', undefined, {
        query: { page, pageSize, unreadOnly }
      }),
    markRead: (notificationId: string) => client.request<NotificationDto>('POST', `/notifications/${notificationId}/read`),
    markAllRead: () => client.request<{ markedRead: number }>('POST', '/notifications/read-all')
  };
}
