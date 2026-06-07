/**
 * FlowOS - src/modules/appointments/appointments.schema.ts
 * Zod DTOs for the appointments module.
 */
import { z } from 'zod';

export const createAppointmentSchema = z.object({
  businessId: z.string().length(24),
  queueId: z.string().length(24).optional(),
  scheduledFor: z.coerce.date(),
  durationSec: z.number().int().min(60).max(28800).optional(),
  notes: z.string().max(500).optional(),
});

export const updateAppointmentSchema = z
  .object({
    scheduledFor: z.coerce.date().optional(),
    durationSec: z.number().int().min(60).max(28800).optional(),
    notes: z.string().max(500).optional(),
    status: z.enum(['CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const idParam = z.object({ id: z.string().length(24) });

export type CreateAppointmentDto = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentDto = z.infer<typeof updateAppointmentSchema>;
