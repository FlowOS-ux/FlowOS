/**
 * FlowOS - src/modules/reviews/reviews.controller.ts
 * HTTP handlers for the reviews module.
 */
import type { Request, Response } from 'express';
import { reviewsService } from './reviews.service';

export async function listForBusiness(req: Request, res: Response): Promise<void> {
  const reviews = await reviewsService.listForBusiness(String(req.params.businessId));
  res.json({ reviews });
}

export async function create(req: Request, res: Response): Promise<void> {
  const review = await reviewsService.create(
    req.user!.id,
    String(req.params.businessId),
    req.body,
  );
  res.status(201).json({ review });
}

export async function update(req: Request, res: Response): Promise<void> {
  const review = await reviewsService.update(req.user!.id, String(req.params.id), req.body);
  res.json({ review });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const result = await reviewsService.remove(req.user!.id, String(req.params.id));
  res.json(result);
}
