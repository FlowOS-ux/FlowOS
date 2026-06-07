/**
 * FlowOS - src/modules/support/support.controller.ts
 * HTTP handlers for the support module.
 */
import type { Request, Response } from 'express';
import { supportService } from './support.service';

export function articles(_req: Request, res: Response): void {
  res.json({ articles: supportService.listArticles() });
}

export async function createTicket(req: Request, res: Response): Promise<void> {
  const ticket = await supportService.createTicket(req.user!.id, req.body);
  res.status(201).json({ ticket });
}

export async function listMine(req: Request, res: Response): Promise<void> {
  const tickets = await supportService.listMine(req.user!.id);
  res.json({ tickets });
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const ticket = await supportService.getOne(req.user!.id, String(req.params.id));
  res.json({ ticket });
}
