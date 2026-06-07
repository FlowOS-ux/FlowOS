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
}
