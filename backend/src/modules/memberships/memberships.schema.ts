/**
 * FlowOS - src/modules/memberships/memberships.schema.ts
 * Zod DTOs for staff management.
 */
import { z } from 'zod';

export const addStaffSchema = z.object({
  email: z.string().email().toLowerCase(),
  role: z.enum(['MANAGER', 'STAFF']).default('STAFF'),
});

export const updateStaffSchema = z.object({
  role: z.enum(['MANAGER', 'STAFF']),
});

export const businessIdParam = z.object({ businessId: z.string().length(24) });
export const idParam = z.object({ id: z.string().length(24) });

export type AddStaffDto = z.infer<typeof addStaffSchema>;
export type UpdateStaffDto = z.infer<typeof updateStaffSchema>;
