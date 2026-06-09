/**
 * FlowOS - src/modules/businesses/businesses.schema.ts
 * Zod request DTOs for the businesses module.
 */
import { z } from 'zod';

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const hourSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  isClosed: z.boolean().optional(),
});

export const createBusinessSchema = z.object({
  name: z.string().min(2).max(120),
  category: z.string().min(2).max(40),
  description: z.string().max(1000).optional(),
  address: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  logoUrl: z.string().url().optional(),
  location: locationSchema.optional(),
});

// Note: `status` is intentionally NOT owner-editable. Going ACTIVE happens only
// through admin approval (POST /businesses/:id/approve). Owners move a business
// into review via POST /businesses/:id/submit.
export const updateBusinessSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    category: z.string().min(2).max(40).optional(),
    description: z.string().max(1000).optional(),
    address: z.string().max(200).optional(),
    phone: z.string().max(20).optional(),
    logoUrl: z.string().url().optional(),
    location: locationSchema.optional(),
    hours: z.array(hourSchema).max(7).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

/** Admin rejection: an optional reason shown back to the owner. */
export const rejectBusinessSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const exploreQuerySchema = z.object({
  search: z.string().max(120).optional(),
  category: z.string().max(40).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(0.1).max(100).default(10),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const businessIdParam = z.object({ id: z.string().length(24) });

export type CreateBusinessDto = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessDto = z.infer<typeof updateBusinessSchema>;
export type RejectBusinessDto = z.infer<typeof rejectBusinessSchema>;
export type ExploreQuery = z.infer<typeof exploreQuerySchema>;
