/**
 * FlowOS - src/modules/support/support.schema.ts
 * Zod DTOs for the support module.
 */
import { z } from 'zod';

export const createTicketSchema = z.object({
  subject: z.string().min(3).max(140),
  message: z.string().min(5).max(2000),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).default('NORMAL'),
});

export const idParam = z.object({ id: z.string().length(24) });

export type CreateTicketDto = z.infer<typeof createTicketSchema>;
