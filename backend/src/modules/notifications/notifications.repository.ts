/**
 * FlowOS - src/modules/notifications/notifications.repository.ts
 * Data-access for the notifications feed and device-token registry.
 */
import { Notification, DeviceToken, type NotificationDoc } from '../../models';

export const notificationsRepository = {
  async list(params: {
    userId: string;
    unread?: boolean;
    skip: number;
    limit: number;
  }): Promise<{ items: NotificationDoc[]; total: number; unread: number }> {
    const filter: Record<string, unknown> = { userId: params.userId };
    if (params.unread) filter.read = false;

    const [items, total, unread] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(params.skip).limit(params.limit).exec(),
      Notification.countDocuments(filter).exec(),
      Notification.countDocuments({ userId: params.userId, read: false }).exec(),
    ]);
    return { items, total, unread };
  },

  markRead(userId: string, id: string): Promise<NotificationDoc | null> {
    return Notification.findOneAndUpdate({ _id: id, userId }, { read: true }, { new: true }).exec();
  },

  markAllRead(userId: string): Promise<unknown> {
    return Notification.updateMany({ userId, read: false }, { read: true }).exec();
  },

  // ---- Device tokens (FCM) ----
  upsertDevice(userId: string, token: string, platform: string): Promise<unknown> {
    return DeviceToken.findOneAndUpdate(
      { token },
      { userId, token, platform, lastSeenAt: new Date() },
      { upsert: true, new: true },
    ).exec();
  },

  removeDevice(userId: string, token: string): Promise<unknown> {
    return DeviceToken.deleteOne({ userId, token }).exec();
  },
};
