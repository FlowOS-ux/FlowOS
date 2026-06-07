/**
 * FlowOS - src/modules/appointments/appointments.controller.ts
 * HTTP handlers for the appointments module.
 */
import type { Request, Response } from 'express';
import { appointmentsService } from './appointments.service';

export async function book(req: Request, res: Response): Promise<void> {
  const appointment = await appointmentsService.book(req.user!.id, req.body);
  res.status(201).json({ appointment });
}

export async function listMine(req: Request, res: Response): Promise<void> {
  const appointments = await appointmentsService.listMine(req.user!.id);
  res.json({ appointments });
}

export async function listForBusiness(req: Request, res: Response): Promise<void> {
  const appointments = await appointmentsService.listForBusiness(
    req.user!.id,
    req.user!.role,
    String(req.params.businessId),
  );
  res.json({ appointments });
}

export async function update(req: Request, res: Response): Promise<void> {
  const appointment = await appointmentsService.update(
    req.user!.id,
    req.user!.role,
    String(req.params.id),
    req.body,
  );
  res.json({ appointment });
}

export async function cancel(req: Request, res: Response): Promise<void> {
  const appointment = await appointmentsService.cancel(
    req.user!.id,
    req.user!.role,
    String(req.params.id),
  );
  res.json({ appointment });
}
