/**
 * FlowOS - src/modules/analytics/analytics.controller.ts
 * HTTP handlers for the analytics module.
 */
import type { Request, Response } from 'express';
import { analyticsService } from './analytics.service';

export async function summary(req: Request, res: Response): Promise<void> {
  const data = await analyticsService.summary(
    req.user!.id,
    req.user!.role,
    String(req.params.businessId),
  );
  res.json({ summary: data });
}

export async function detailed(req: Request, res: Response): Promise<void> {
  const days = Math.min(Math.max(Number(req.query.days ?? 7), 1), 90);
  const data = await analyticsService.detailed(
    req.user!.id,
    req.user!.role,
    String(req.params.businessId),
    days,
  );
  res.json({ analytics: data });
}
