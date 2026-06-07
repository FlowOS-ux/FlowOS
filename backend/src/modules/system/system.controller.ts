/**
 * FlowOS - src/modules/system/system.controller.ts
 * Health check (used by the mobile Connection Error screen) and public app config
 * (used by Splash/Onboarding).
 */
import type { Request, Response } from 'express';
import mongoose from 'mongoose';

export function health(_req: Request, res: Response): void {
  const dbState = mongoose.connection.readyState; // 1 = connected
  res.json({
    status: 'ok',
    db: dbState === 1 ? 'connected' : 'disconnected',
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
