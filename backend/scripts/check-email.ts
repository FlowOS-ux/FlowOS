/**
 * FlowOS - scripts/check-email.ts
 * One-shot config check: parses .env, reports which email provider is selected,
 * and (for SMTP) probes the connection so a bad Gmail App Password is caught
 * before deploying. Usage: npx tsx scripts/check-email.ts
 */
import nodemailer from 'nodemailer';
import { env } from '../src/config/env';

async function main(): Promise<void> {
  const provider = env.GOOGLE_REFRESH_TOKEN
    ? 'gmail-api'
    : env.BREVO_API_KEY
      ? 'brevo'
      : env.RESEND_API_KEY
        ? 'resend'
        : env.MAILJET_API_KEY && env.MAILJET_SECRET_KEY
          ? 'mailjet'
          : env.SMTP_HOST && env.SMTP_USER
            ? 'smtp'
            : 'console (demo mode — OTP shown in-app, no real email)';

  console.log(`Email provider selected: ${provider}`);
  console.log(`EMAIL_FROM: ${env.EMAIL_FROM}`);

  if (provider === 'smtp') {
    console.log(`Probing ${env.SMTP_HOST}:${env.SMTP_PORT} as ${env.SMTP_USER} ...`);
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
    try {
      await transporter.verify();
      console.log('SMTP AUTH OK — real email delivery will be ACTIVE.');
    } catch (err) {
      console.error(`SMTP AUTH FAILED: ${(err as Error).message}`);
      process.exitCode = 1;
    }
  }
}

void main();
