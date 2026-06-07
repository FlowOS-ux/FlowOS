/**
 * FlowOS - src/modules/reviews/reviews.schema.ts
 * Zod DTOs for the reviews module.
 */
import { z } from 'zod';

export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export const updateReviewSchema = z
  .object({
    rating: z.number().int().min(1).max(5).optional(),
    comment: z.string().max(1000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const businessIdParam = z.object({ businessId: z.string().length(24) });
export const idParam = z.object({ id: z.string().length(24) });

export type CreateReviewDto = z.infer<typeof createReviewSchema>;
export type UpdateReviewDto = z.infer<typeof updateReviewSchema>;
