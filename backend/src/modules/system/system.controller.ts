/**
 * FlowOS - src/modules/system/system.controller.ts
 * Health check (used by the mobile connectivity probe + recovery polling) and
 * public app config (used by Splash/Onboarding).
 */
import type { Request, Response } from 'express';
import { isDbHealthy } from '../../config/db';
import { emailProvider } from '../../container';

/**
 * Readiness-style health: always returns HTTP 200 so a platform health check
 * won't kill the container over a brief DB blip, but reports `ready`/`db` so the
 * client can tell whether the backend can actually serve data yet. The mobile app
 * polls this to detect recovery and refetch automatically (no manual refresh).
 */
export function health(_req: Request, res: Response): void {
  const dbConnected = isDbHealthy();
  res.json({
    status: dbConnected ? 'ok' : 'degraded',
    ready: dbConnected,
    db: dbConnected ? 'connected' : 'disconnected',
    // Active email transport label (no secrets) so the deployed provider can be confirmed
    // without reading logs or sending a test email: gmail | brevo | resend | mailjet | smtp | console.
    email: emailProvider,
    uptimeSec: Math.round(process.uptime()),
  });
}

export function config(_req: Request, res: Response): void {
  res.json({
    appName: 'FlowOS',
    minSupportedVersion: '1.0.0',
    features: { appointments: true, reviews: true, aiAssistant: true },
  });
}
