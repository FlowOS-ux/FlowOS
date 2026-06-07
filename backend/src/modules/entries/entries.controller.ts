/**
 * FlowOS - src/modules/entries/entries.controller.ts
 * HTTP handlers for the queue entries engine.
 */
import type { Request, Response } from 'express';
import { entriesService } from './entries.service';

// ---- Customer ----
export async function join(req: Request, res: Response): Promise<void> {
  const entry = await entriesService.join(req.user!.id, String(req.params.queueId));
  res.status(201).json({ entry });
}

export async function myEntries(req: Request, res: Response): Promise<void> {
  const entries = await entriesService.getMyActiveEntries(req.user!.id);
  res.json({ entries });
}

export async function leave(req: Request, res: Response): Promise<void> {
  const entry = await entriesService.leave(req.user!.id, String(req.params.id));
  res.json({ entry });
}

// ---- Staff / operator ----
export async function listForQueue(req: Request, res: Response): Promise<void> {
  const entries = await entriesService.listForOperator(
    req.user!.id,
    req.user!.role,
    String(req.params.queueId),
  );
  res.json({ entries });
}

export async function callNext(req: Request, res: Response): Promise<void> {
  const entry = await entriesService.callNext(
    req.user!.id,
    req.user!.role,
    String(req.params.queueId),
  );
  res.json({ entry });
}

export async function startServing(req: Request, res: Response): Promise<void> {
  const entry = await entriesService.startServing(req.user!.id, req.user!.role, String(req.params.id));
  res.json({ entry });
}

export async function complete(req: Request, res: Response): Promise<void> {
  const entry = await entriesService.complete(req.user!.id, req.user!.role, String(req.params.id));
  res.json({ entry });
}

export async function noShow(req: Request, res: Response): Promise<void> {
  const entry = await entriesService.noShow(req.user!.id, req.user!.role, String(req.params.id));
  res.json({ entry });
}
