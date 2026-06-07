/**
 * FlowOS - src/modules/entries/entries.schema.ts
 * Zod param DTOs for the entries module. (Most actions are identified by URL ids.)
 */
import { z } from 'zod';

export const queueIdParam = z.object({ queueId: z.string().length(24) });
export const entryIdParam = z.object({ id: z.string().length(24) });
