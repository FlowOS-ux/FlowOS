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

/** AI Assistant service-recommendation request. */
export const recommendSchema = z.object({
  message: z.string().min(1).max(500),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  limit: z.coerce.number().int().min(1).max(10).optional(),
});

export type RecommendDto = z.infer<typeof recommendSchema>;
