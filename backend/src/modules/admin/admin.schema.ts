/**
 * FlowOS - src/modules/admin/admin.schema.ts
 * Zod DTOs for the admin verification endpoints.
 */
import { z } from 'zod';

export const businessIdParam = z.object({ id: z.string().length(24) });

/** Optional reason recorded on rejection and shown back to the owner. */
export const rejectBusinessSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type RejectBusinessDto = z.infer<typeof rejectBusinessSchema>;
