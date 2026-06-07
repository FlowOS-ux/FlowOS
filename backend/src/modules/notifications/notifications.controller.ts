/**
 * FlowOS - src/modules/notifications/notifications.controller.ts
 * HTTP handlers for the notifications feed and device registration.
 */
import type { Request, Response } from 'express';
import { notificationsService } from './notifications.service';
import type { ListQuery } from './notifications.schema';

export async function list(req: Request, res: Response): Promise<void> {
  const result = await notificationsService.list(req.user!.id, req.validatedQuery as ListQuery);
  res.json(result);
}

export async function markRead(req: Request, res: Response): Promise<void> {
  const notification = await notificationsService.markRead(req.user!.id, String(req.params.id));
  res.json({ notification });
}

export async function markAllRead(req: Request, res: Response): Promise<void> {
  const result = await notificationsService.markAllRead(req.user!.id);
  res.json(result);
}

export async function registerDevice(req: Request, res: Response): Promise<void> {
  const result = await notificationsService.registerDevice(req.user!.id, req.body);
  res.status(201).json(result);
}

export async function removeDevice(req: Request, res: Response): Promise<void> {
  const result = await notificationsService.removeDevice(req.user!.id, String(req.params.token));
  res.json(result);
}
