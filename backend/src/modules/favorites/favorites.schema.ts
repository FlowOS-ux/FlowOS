/**
 * FlowOS - src/modules/favorites/favorites.schema.ts
 * Zod DTOs for the saved-places (favorites) module.
 */
import { z } from 'zod';

export const addFavoriteSchema = z.object({ businessId: z.string().length(24) });
export const businessIdParam = z.object({ businessId: z.string().length(24) });

export type AddFavoriteDto = z.infer<typeof addFavoriteSchema>;
