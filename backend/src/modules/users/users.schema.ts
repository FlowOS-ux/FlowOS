/**
 * FlowOS - src/modules/users/users.schema.ts
 * Zod request DTOs for the users module.
 */
import { z } from 'zod';

export const updateProfileSchema = z
  .object({
    name: z.string().min(2).max(80).optional(),
    phone: z.string().min(6).max(20).optional(),
    avatarUrl: z.string().url().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const updateSettingsSchema = z
  .object({
    language: z.string().min(2).max(8).optional(),
    notificationsEnabled: z.boolean().optional(),
    pushEnabled: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No settings to update' });

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
export type UpdateSettingsDto = z.infer<typeof updateSettingsSchema>;
