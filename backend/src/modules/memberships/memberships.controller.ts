/**
 * FlowOS - src/modules/memberships/memberships.controller.ts
 * HTTP handlers for staff management.
 */
import type { Request, Response } from 'express';
import { membershipsService } from './memberships.service';

export async function list(req: Request, res: Response): Promise<void> {
  const staff = await membershipsService.list(
    req.user!.id,
    req.user!.role,
    String(req.params.businessId),
  );
  res.json({ staff });
}

export async function add(req: Request, res: Response): Promise<void> {
  const member = await membershipsService.add(
    req.user!.id,
    req.user!.role,
    String(req.params.businessId),
    req.body,
  );
  res.status(201).json({ member });
}

export async function updateRole(req: Request, res: Response): Promise<void> {
  const member = await membershipsService.updateRole(
    req.user!.id,
    req.user!.role,
    String(req.params.id),
    req.body,
  );
  res.json({ member });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const result = await membershipsService.remove(
    req.user!.id,
    req.user!.role,
    String(req.params.id),
  );
  res.json(result);
}
