/**
 * FlowOS - src/modules/favorites/favorites.controller.ts
 * HTTP handlers for the saved-places module.
 */
import type { Request, Response } from 'express';
import { favoritesService } from './favorites.service';

export async function listMine(req: Request, res: Response): Promise<void> {
  const favorites = await favoritesService.listMine(req.user!.id);
  res.json({ favorites });
}

export async function add(req: Request, res: Response): Promise<void> {
  const favorite = await favoritesService.add(req.user!.id, req.body.businessId);
  res.status(201).json({ favorite });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const result = await favoritesService.remove(req.user!.id, String(req.params.businessId));
  res.json(result);
}
