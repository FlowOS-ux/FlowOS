/**
 * FlowOS - src/services/email/brevo.email.ts
 * Transactional email via Brevo's HTTP API (https://api.brevo.com/v3/smtp/email).
 * Sends over HTTPS:443, so it works on hosts that block outbound SMTP (e.g. Railway).
 * Activated by the container when BREVO_API_KEY is set; otherwise SMTP/console is used.
 */
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import type { EmailMessage, IEmailService } from './email.interface';

/** Parse an EMAIL_FROM of "Name <email>" (or bare "email") into Brevo's sender shape. */
function parseSender(from: string): { name?: string; email: string } {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  if (match) return { name: match[1] || undefined, email: match[2].trim() };
  return { email: from.trim() };
}

export class BrevoEmailService implements IEmailService {
  async send(message: EmailMessage): Promise<void> {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': env.BREVO_API_KEY as string,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: parseSender(env.EMAIL_FROM),
        to: [{ email: message.to }],
        subject: message.subject,
        ...(message.html ? { htmlContent: message.html } : {}),
        textContent: message.text ?? '',
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Brevo send failed (${res.status}): ${detail}`);
    }
    logger.info({ to: message.to, subject: message.subject }, 'email sent (Brevo)');
  }

  /** Confirm the API key is accepted at boot and log the active mode loudly. */
  async verifyConnection(): Promise<void> {
    try {
      const res = await fetch('https://api.brevo.com/v3/account', {
        headers: { 'api-key': env.BREVO_API_KEY as string, accept: 'application/json' },
      });
      if (res.ok) {
        logger.info(
          { from: env.EMAIL_FROM },
          '[email] Brevo HTTP API ready — real email delivery is ACTIVE',
        );
      } else {
        logger.error(
          { status: res.status },
          '[email] Brevo API key REJECTED — outgoing email will fail',
        );
      }
    } catch (err) {
      logger.error({ err }, '[email] Brevo verify failed');
    }
  }
}
