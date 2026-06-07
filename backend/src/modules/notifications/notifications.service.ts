/**
 * FlowOS - src/modules/notifications/notifications.service.ts
 * Notification feed reads, read-state updates, and device-token registration.
 * (Outbound delivery lives in services/notification — this is the user-facing API.)
 */
import { notificationsRepository } from './notifications.repository';
import { NotFoundError } from '../../lib/errors';
import type { NotificationDoc } from '../../models';
import type { ListQuery, RegisterDeviceDto } from './notifications.schema';

function toPublic(n: NotificationDoc) {
  return {
    id: n.id as string,
    type: n.type,
    title: n.title,
    body: n.body,
    data: n.data ?? null,
    read: n.read,
    createdAt: n.createdAt,
  };
}

export const notificationsService = {
  async list(userId: string, query: ListQuery) {
    const skip = (query.page - 1) * query.limit;
    const { items, total, unread } = await notificationsRepository.list({
      userId,
      unread: query.unread,
      skip,
      limit: query.limit,
    });
    return { items: items.map(toPublic), total, unread, page: query.page, limit: query.limit };
  },

  async markRead(userId: string, id: string) {
    const updated = await notificationsRepository.markRead(userId, id);
    if (!updated) throw new NotFoundError('Notification not found');
    return toPublic(updated);
  },

  async markAllRead(userId: string) {
    await notificationsRepository.markAllRead(userId);
    return { success: true };
  },

  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    await notificationsRepository.upsertDevice(userId, dto.token, dto.platform);
    return { success: true };
  },

  async removeDevice(userId: string, token: string) {
    await notificationsRepository.removeDevice(userId, token);
    return { success: true };
  },
};
