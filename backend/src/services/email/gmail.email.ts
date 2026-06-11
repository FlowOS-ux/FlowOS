/**
 * FlowOS - src/services/email/gmail.email.ts
 * Sends email via the Gmail API over HTTPS:443, so it works where outbound SMTP is
 * blocked (e.g. Railway). Uses an OAuth2 refresh token to mint short-lived access
 * tokens. Activated by the container when GOOGLE_REFRESH_TOKEN (+ client id/secret)
 * are configured. EMAIL_FROM must be the authorized Gmail account.
 */
import { randomUUID } from 'node:crypto';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import type { EmailMessage, IEmailService } from './email.interface';

export class GmailApiEmailService implements IEmailService {
  private accessToken: string | null = null;
  private expiresAt = 0;

  /** Exchange the long-lived refresh token for a cached access token. */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.expiresAt - 30_000) return this.accessToken;
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID as string,
        client_secret: env.GOOGLE_CLIENT_SECRET as string,
        refresh_token: env.GOOGLE_REFRESH_TOKEN as string,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Gmail token refresh failed (${res.status}): ${detail}`);
    }
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.accessToken = json.access_token;
    this.expiresAt = Date.now() + json.expires_in * 1000;
    return this.accessToken;
  }

  /** Build a base64url RFC-822 message (multipart/alternative when HTML is present). */
  private buildRaw(message: EmailMessage): string {
    const headers = [
      `From: ${env.EMAIL_FROM}`,
      `To: ${message.to}`,
      `Subject: ${message.subject}`,
      'MIME-Version: 1.0',
    ];
    let body: string;
    if (message.html) {
      const boundary = `flowos_${randomUUID()}`;
      headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
      body = [
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        '',
        message.text ?? '',
        `--${boundary}`,
        'Content-Type: text/html; charset="UTF-8"',
        '',
        message.html,
        `--${boundary}--`,
        '',
      ].join('\r\n');
    } else {
      headers.push('Content-Type: text/plain; charset="UTF-8"');
      body = message.text ?? '';
    }
    const mime = `${headers.join('\r\n')}\r\n\r\n${body}`;
    return Buffer.from(mime, 'utf8').toString('base64url');
  }

  async send(message: EmailMessage): Promise<void> {
    const token = await this.getAccessToken();
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ raw: this.buildRaw(message) }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Gmail send failed (${res.status}): ${detail}`);
    }
    logger.info({ to: message.to, subject: message.subject }, 'email sent (Gmail API)');
  }

  /** Confirm the refresh token still mints an access token; log the active mode. */
  async verifyConnection(): Promise<void> {
    try {
      await this.getAccessToken();
      logger.info(
        { from: env.EMAIL_FROM },
        '[email] Gmail API ready — real email delivery is ACTIVE',
      );
    } catch (err) {
      logger.error({ err }, '[email] Gmail API auth FAILED — outgoing email will fail');
    }
  }
}
