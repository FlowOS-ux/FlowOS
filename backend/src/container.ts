/**
 * FlowOS - src/container.ts
 * Composition root. Builds the concrete service implementations once and exposes
 * them as singletons. Modules import these interfaces — never the implementations —
 * so swapping (e.g. realtime impl, storage backend) happens here only.
 */
import type { Server } from 'socket.io';

import type { IRealtimeService } from './services/realtime/realtime.interface';
import { NoopRealtimeService } from './services/realtime/noop.realtime';
import { SocketRealtimeService } from './services/realtime/socket.realtime';

import { FcmPushService } from './services/notification/fcm.notification';
import { InAppNotificationService } from './services/notification/inapp.notification';
import type { INotificationService } from './services/notification/notification.interface';

import { SmtpEmailService } from './services/email/smtp.email';
import type { IEmailService } from './services/email/email.interface';

import { LocalStorageService } from './services/storage/local.storage';
import type { IStorageService } from './services/storage/storage.interface';

import { GroqAssistant } from './services/ai/groq.assistant';
import type { IAssistant } from './services/ai/assistant.interface';

// Realtime starts as a no-op and is upgraded to Socket.IO once the server exists.
let realtime: IRealtimeService = new NoopRealtimeService();

export const push = new FcmPushService();
export const email: IEmailService = new SmtpEmailService();
export const storage: IStorageService = new LocalStorageService();
export const assistant: IAssistant = new GroqAssistant();

export const notifications: INotificationService = new InAppNotificationService(
  () => realtime,
  push,
);

/** Called from server.ts once the Socket.IO server is created. */
export function initRealtime(io: Server): void {
  realtime = new SocketRealtimeService(io);
}

/** Accessor for the current realtime implementation. */
export function getRealtime(): IRealtimeService {
  return realtime;
}

/** Initialize async-capable services (e.g. FCM) at boot. */
export async function initServices(): Promise<void> {
  await push.init();
}
