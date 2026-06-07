/**
 * FlowOS - src/services/notification/inapp.notification.ts
 * Default notification delivery: persist an in-app Notification, emit it to the
 * user's socket room in real time, and fan out a push via FCM. Each channel is
 * best-effort — a failure in one never blocks the others.
 */
import { Notification } from '../../models';
import { logger } from '../../lib/logger';
import { type IRealtimeService, RT_EVENTS } from '../realtime/realtime.interface';
import type { IPushService } from './fcm.notification';
import type { INotificationService, NotificationInput } from './notification.interface';

export class InAppNotificationService implements INotificationService {
  constructor(
    // Provider so the realtime impl can be swapped after Socket.IO initializes.
    private readonly getRealtime: () => IRealtimeService,
    private readonly push: IPushService,
  ) {}

  async notify(userId: string, input: NotificationInput): Promise<void> {
    // 1) Persist (always — this is the source of truth for the Notifications screen).
    const doc = await Notification.create({
      userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data,
    });

    // 2) Real-time emit (foreground apps update instantly).
    try {
      this.getRealtime().emitToUser(userId, RT_EVENTS.NOTIFICATION_NEW, {
        id: doc.id,
        type: doc.type,
        title: doc.title,
        body: doc.body,
        data: doc.data,
        createdAt: doc.createdAt,
      });
    } catch (err) {
      logger.error({ err, userId }, 'realtime notify failed');
    }

    // 3) Push (background/killed apps).
    try {
      await this.push.sendToUser(userId, {
        title: input.title,
        body: input.body,
        data: input.data ? stringifyData(input.data) : undefined,
      });
    } catch (err) {
      logger.error({ err, userId }, 'push notify failed');
    }
  }
}

// FCM data payloads must be string->string.
function stringifyData(data: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) out[k] = typeof v === 'string' ? v : JSON.stringify(v);
  return out;
}
