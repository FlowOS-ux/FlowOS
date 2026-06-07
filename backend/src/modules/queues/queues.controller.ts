/**
 * FlowOS - src/modules/queues/queues.controller.ts
 * HTTP handlers for the queues module.
 */
import type { Request, Response } from 'express';
import { queuesService } from './queues.service';

export async function listByBusiness(req: Request, res: Response): Promise<void> {
  const queues = await queuesService.listByBusiness(String(req.params.businessId));
  res.json({ queues });
}

export async function create(req: Request, res: Response): Promise<void> {
  const queue = await queuesService.create(
    req.user!.id,
    req.user!.role,
    String(req.params.businessId),
    req.body,
  );
  res.status(201).json({ queue });
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const queue = await queuesService.getById(String(req.params.id));
  res.json({ queue });
}

export async function update(req: Request, res: Response): Promise<void> {
  const queue = await queuesService.update(
    req.user!.id,
    req.user!.role,
    String(req.params.id),
    req.body,
  );
  res.json({ queue });
}
