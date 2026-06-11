/**
 * FlowOS - src/services/email/email.interface.ts
 * Contract for sending transactional email (password reset, staff invites).
 */
export interface EmailMessage {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface IEmailService {
  send(message: EmailMessage): Promise<void>;
  /** Optional: probe SMTP connectivity at boot and log the active mode (real vs console). */
  verifyConnection?(): Promise<void>;
}
