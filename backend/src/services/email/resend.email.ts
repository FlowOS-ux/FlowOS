/**
 * FlowOS - src/services/email/resend.email.ts
 * Sends email via the Resend HTTP API (https://api.resend.com/emails) over HTTPS:443,
 * so it works where outbound SMTP is blocked (e.g. Railway). Activated when
 * RESEND_API_KEY is set. In Resend's no-domain test mode, EMAIL_FROM must be
 * "onboarding@resend.dev" and recipients are limited to your own account email.
 */
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import type { EmailMessage, IEmailService } from './email.interface';

export class ResendEmailService implements IEmailService {
  async send(message: EmailMessage): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY as string}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        ...(message.html ? { html: message.html } : {}),
        text: message.text ?? '',
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Resend send failed (${res.status}): ${detail}`);
    }
    logger.info({ to: message.to, subject: message.subject }, 'email sent (Resend)');
  }

  /** Log the active mode at boot. Resend has no auth-only ping a "Sending access"
   *  key can read (the /domains endpoint 401s for send-only keys), so the key is
   *  validated on the first real send rather than here. */
  async verifyConnection(): Promise<void> {
    if (env.RESEND_API_KEY) {
      logger.info(
        { from: env.EMAIL_FROM },
        '[email] Resend configured — real email delivery is ACTIVE (key validated on first send)',
      );
    }
  }
}
