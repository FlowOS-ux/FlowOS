/**
 * FlowOS - src/services/email/mailjet.email.ts
 * Sends email via the Mailjet Send API v3.1 over HTTPS:443, so it works where
 * outbound SMTP is blocked (e.g. Railway). Activated when MAILJET_API_KEY +
 * MAILJET_SECRET_KEY are set. EMAIL_FROM's address must be a Mailjet-validated sender.
 */
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import type { EmailMessage, IEmailService } from './email.interface';

/** Parse an EMAIL_FROM of "Name <email>" (or bare "email") into Mailjet's sender shape. */
function parseSender(from: string): { Email: string; Name?: string } {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  if (match) return { Name: match[1] || undefined, Email: match[2].trim() };
  return { Email: from.trim() };
}

/** HTTP Basic auth: API key as user, secret key as password. */
function authHeader(): string {
  const token = Buffer.from(`${env.MAILJET_API_KEY}:${env.MAILJET_SECRET_KEY}`).toString('base64');
  return `Basic ${token}`;
}

export class MailjetEmailService implements IEmailService {
  async send(message: EmailMessage): Promise<void> {
    const res = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: { authorization: authHeader(), 'content-type': 'application/json' },
      body: JSON.stringify({
        Messages: [
          {
            From: parseSender(env.EMAIL_FROM),
            To: [{ Email: message.to }],
            Subject: message.subject,
            TextPart: message.text ?? '',
            ...(message.html ? { HTMLPart: message.html } : {}),
          },
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Mailjet send failed (${res.status}): ${detail}`);
    }
    logger.info({ to: message.to, subject: message.subject }, 'email sent (Mailjet)');
  }

  /** Confirm the key+secret are accepted at boot and log the active mode loudly. */
  async verifyConnection(): Promise<void> {
    try {
      const res = await fetch('https://api.mailjet.com/v3/REST/sender?Limit=1', {
        headers: { authorization: authHeader() },
      });
      if (res.ok) {
        logger.info(
          { from: env.EMAIL_FROM },
          '[email] Mailjet HTTP API ready — real email delivery is ACTIVE',
        );
      } else {
        logger.error(
          { status: res.status },
          '[email] Mailjet credentials REJECTED — outgoing email will fail',
        );
      }
    } catch (err) {
      logger.error({ err }, '[email] Mailjet verify failed');
    }
  }
}
