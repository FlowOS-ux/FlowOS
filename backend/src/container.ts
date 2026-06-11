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
import { BrevoEmailService } from './services/email/brevo.email';
import { GmailApiEmailService } from './services/email/gmail.email';
import { ResendEmailService } from './services/email/resend.email';
import { MailjetEmailService } from './services/email/mailjet.email';
import type { IEmailService } from './services/email/email.interface';
import { env } from './config/env';

import { LocalStorageService } from './services/storage/local.storage';
import type { IStorageService } from './services/storage/storage.interface';

import { GroqAssistant } from './services/ai/groq.assistant';
import type { IAssistant } from './services/ai/assistant.interface';

// Realtime starts as a no-op and is upgraded to Socket.IO once the server exists.
let realtime: IRealtimeService = new NoopRealtimeService();

export const push = new FcmPushService();

// Pick the email transport by configured credentials, returning both the instance and a
// short label. The HTTP-based senders (Gmail API, Brevo, Resend) work where SMTP egress
// is blocked (e.g. Railway); real SMTP is the local default; 'console' is the dev
// fallback that only logs codes (never delivers). This is the SINGLE source of truth —
// `emailProvider` and `emailConfigured` below both derive from it, so they can't drift.
function selectEmailService(): { service: IEmailService; provider: string } {
  if (env.GOOGLE_REFRESH_TOKEN) return { service: new GmailApiEmailService(), provider: 'gmail' };
  if (env.BREVO_API_KEY) return { service: new BrevoEmailService(), provider: 'brevo' };
  if (env.RESEND_API_KEY) return { service: new ResendEmailService(), provider: 'resend' };
  if (env.MAILJET_API_KEY && env.MAILJET_SECRET_KEY)
    return { service: new MailjetEmailService(), provider: 'mailjet' };
  if (env.SMTP_HOST && env.SMTP_USER) return { service: new SmtpEmailService(), provider: 'smtp' };
  return { service: new SmtpEmailService(), provider: 'console' };
}
const selectedEmail = selectEmailService();
export const email: IEmailService = selectedEmail.service;
/** Active transport label for diagnostics: gmail | brevo | resend | mailjet | smtp | console. */
export const emailProvider: string = selectedEmail.provider;
/** True when a real provider will actually deliver mail (i.e. NOT the console fallback).
 *  When false, the auth flow exposes `devCode` so local dev stays testable without an inbox. */
export const emailConfigured: boolean = emailProvider !== 'console';
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
  // Probe SMTP and log whether real email delivery is active (non-fatal).
  await email.verifyConnection?.();
}
