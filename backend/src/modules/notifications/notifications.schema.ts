/**
 * FlowOS - src/modules/notifications/notifications.schema.ts
 * Zod DTOs for the notifications module (feed + device-token registration).
 */
import { z } from 'zod';

export const listQuerySchema = z.object({
  unread: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const idParam = z.object({ id: z.string().length(24) });

export const registerDeviceSchema = z.object({
  token: z.string().min(10).max(4096),
  platform: z.enum(['IOS', 'ANDROID', 'WEB']).default('ANDROID'),
});

export const deviceTokenParam = z.object({ token: z.string().min(10) });

export type ListQuery = z.infer<typeof listQuerySchema>;
export type RegisterDeviceDto = z.infer<typeof registerDeviceSchema>;
