/**
 * FlowOS - src/modules/queues/queues.schema.ts
 * Zod request DTOs for the queues module.
 */
import { z } from 'zod';

export const createQueueSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  avgServiceSec: z.number().int().min(30).max(7200).optional(),
  maxCapacity: z.number().int().min(1).max(10000).optional(),
});

export const updateQueueSchema = z
  .object({
    name: z.string().min(2).max(80).optional(),
    description: z.string().max(500).optional(),
    status: z.enum(['OPEN', 'PAUSED', 'CLOSED']).optional(),
    avgServiceSec: z.number().int().min(30).max(7200).optional(),
    maxCapacity: z.number().int().min(1).max(10000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const queueIdParam = z.object({ id: z.string().length(24) });
export const businessIdParam = z.object({ businessId: z.string().length(24) });

export type CreateQueueDto = z.infer<typeof createQueueSchema>;
export type UpdateQueueDto = z.infer<typeof updateQueueSchema>;
