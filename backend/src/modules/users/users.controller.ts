/**
 * FlowOS - src/modules/users/users.controller.ts
 * HTTP handlers for the users module. All routes are authenticated; the acting
 * user comes from req.user (never from the URL).
 */
import type { Request, Response } from 'express';
import { usersService } from './users.service';

export async function getMe(req: Request, res: Response): Promise<void> {
  const user = await usersService.getProfile(req.user!.id);
  res.json({ user });
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  const user = await usersService.updateProfile(req.user!.id, req.body);
  res.json({ user });
}

export async function getSettings(req: Request, res: Response): Promise<void> {
  const user = await usersService.getProfile(req.user!.id);
  res.json({ settings: user.settings });
}

export async function updateSettings(req: Request, res: Response): Promise<void> {
  const user = await usersService.updateSettings(req.user!.id, req.body);
  res.json({ settings: user.settings });
}

export async function completeOnboarding(req: Request, res: Response): Promise<void> {
  const user = await usersService.completeOnboarding(req.user!.id);
  res.json({ user });
}
