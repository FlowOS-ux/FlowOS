/**
 * FlowOS - src/services/notification/fcm.notification.ts
 * Firebase Cloud Messaging push sender. Lazily initializes firebase-admin from the
 * service-account path in env. If FCM isn't configured, every call is a safe no-op,
 * so the rest of the app runs unchanged in dev.
 */
import { readFileSync } from 'node:fs';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { DeviceToken } from '../../models';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface IPushService {
  sendToUser(userId: string, payload: PushPayload): Promise<void>;
}

export class FcmPushService implements IPushService {
  private enabled = false;
  // Loaded dynamically so the app boots even without firebase-admin configured.
  private messaging: { sendEachForMulticast: (msg: unknown) => Promise<unknown> } | null = null;

  async init(): Promise<void> {
    if (!env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      logger.info('FCM not configured — push notifications disabled');
      return;
    }
    try {
      const admin = (await import('firebase-admin')).default;
      const serviceAccount = JSON.parse(readFileSync(env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf-8'));
      if (admin.apps.length === 0) {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      }
      this.messaging = admin.messaging() as unknown as FcmPushService['messaging'];
      this.enabled = true;
      logger.info('FCM initialized');
    } catch (err) {
      logger.error({ err }, 'Failed to initialize FCM — push disabled');
    }
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    if (!this.enabled || !this.messaging) return;
    const devices = await DeviceToken.find({ userId }).lean();
    const tokens = devices.map((d) => d.token).filter(Boolean);
    if (tokens.length === 0) return;

    try {
      await this.messaging.sendEachForMulticast({
        tokens,
        notification: { title: payload.title, body: payload.body },
        data: payload.data ?? {},
      });
    } catch (err) {
      logger.error({ err, userId }, 'FCM send failed');
    }
  }
}
