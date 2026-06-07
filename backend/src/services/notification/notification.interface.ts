/**
 * FlowOS - src/services/notification/notification.interface.ts
 * Contract for delivering a notification to a user. The default implementation
 * persists an in-app record, emits it in real time, and pushes via FCM.
 */
import type { NotificationType } from '../../types';

export interface NotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface INotificationService {
  notify(userId: string, input: NotificationInput): Promise<void>;
}
