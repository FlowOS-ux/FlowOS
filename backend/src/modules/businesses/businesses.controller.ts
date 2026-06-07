/**
 * FlowOS - src/modules/businesses/businesses.controller.ts
 * HTTP handlers for the businesses module.
 */
import type { Request, Response } from 'express';
import { businessesService } from './businesses.service';
import type { ExploreQuery } from './businesses.schema';

export async function explore(req: Request, res: Response): Promise<void> {
  const result = await businessesService.explore(req.validatedQuery as ExploreQuery);
  res.json(result);
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const business = await businessesService.getById(String(req.params.id));
  res.json({ business });
}

export async function create(req: Request, res: Response): Promise<void> {
  const business = await businessesService.register(req.user!.id, req.body);
  res.status(201).json({ business });
}

export async function update(req: Request, res: Response): Promise<void> {
  const business = await businessesService.update(
    req.user!.id,
    req.user!.role,
    String(req.params.id),
    req.body,
  );
  res.json({ business });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await businessesService.remove(req.user!.id, req.user!.role, String(req.params.id));
  res.json({ success: true });
}

export async function listMine(req: Request, res: Response): Promise<void> {
  const businesses = await businessesService.listMine(req.user!.id);
  res.json({ businesses });
}
