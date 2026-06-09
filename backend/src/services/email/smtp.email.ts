/**
 * FlowOS - src/services/email/smtp.email.ts
 * Nodemailer SMTP email sender. When SMTP isn't configured (dev), it logs the
 * message to the console instead of sending — so flows like password reset are
 * fully testable without an email provider.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import type { EmailMessage, IEmailService } from './email.interface';

export class SmtpEmailService implements IEmailService {
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter | null {
    // Require both host and user — otherwise fall back to console transport so
    // signup/verification still works while SMTP credentials aren't configured.
    if (!env.SMTP_HOST || !env.SMTP_USER) return null;
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      });
    }
    return this.transporter;
  }

  async send(message: EmailMessage): Promise<void> {
    const transporter = this.getTransporter();
    if (!transporter) {
      // Dev fallback: surface the email contents in the logs.
      logger.info({ email: message }, '[DEV EMAIL] (SMTP not configured) — would send');
      return;
    }
    await transporter.sendMail({ from: env.EMAIL_FROM, ...message });
    logger.info({ to: message.to, subject: message.subject }, 'email sent');
  }
}
