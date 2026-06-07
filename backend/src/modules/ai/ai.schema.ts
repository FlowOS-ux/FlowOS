/**
 * FlowOS - src/modules/ai/ai.schema.ts
 * Zod DTOs for the AI assistant module.
 */
import { z } from 'zod';

export const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  conversationId: z.string().length(24).optional(),
});

export const idParam = z.object({ id: z.string().length(24) });

export type ChatDto = z.infer<typeof chatSchema>;
