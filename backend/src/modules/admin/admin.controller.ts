/**
 * FlowOS - src/modules/admin/admin.controller.ts
 * HTTP handlers for the admin verification dashboard. RBAC is enforced by the router.
 */
import type { Request, Response } from 'express';
import { adminService } from './admin.service';

export async function listPending(_req: Request, res: Response): Promise<void> {
  const businesses = await adminService.listBusinessesByStatus('PENDING_VERIFICATION');
  res.json({ businesses });
}

export async function listApproved(_req: Request, res: Response): Promise<void> {
  const businesses = await adminService.listBusinessesByStatus('APPROVED');
  res.json({ businesses });
}

export async function listRejected(_req: Request, res: Response): Promise<void> {
  const businesses = await adminService.listBusinessesByStatus('REJECTED');
  res.json({ businesses });
}

export async function approve(req: Request, res: Response): Promise<void> {
  const business = await adminService.approve(req.user!.id, String(req.params.id));
  res.json({ business });
}

export async function reject(req: Request, res: Response): Promise<void> {
  const business = await adminService.reject(req.user!.id, String(req.params.id), req.body);
  res.json({ business });
}
