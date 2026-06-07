/**
 * FlowOS - src/modules/favorites/favorites.service.ts
 * Save, list, and remove favorite businesses ("Saved Places").
 */
import { favoritesRepository } from './favorites.repository';
import { businessesRepository } from '../businesses/businesses.repository';
import { NotFoundError } from '../../lib/errors';
import type { SavedBusinessDoc } from '../../models';

function toPublic(s: SavedBusinessDoc) {
  const b = s.businessId as unknown as Record<string, unknown> | null;
  const isPopulated = b && typeof b === 'object' && 'name' in b;
  return {
    id: s.id as string,
    businessId: isPopulated ? String((b as { _id?: unknown })._id) : String(s.businessId),
    business: isPopulated
      ? {
          id: String((b as { _id?: unknown })._id),
          name: (b as { name?: string }).name,
          category: (b as { category?: string }).category,
          logoUrl: (b as { logoUrl?: string }).logoUrl ?? null,
          ratingAvg: (b as { ratingAvg?: number }).ratingAvg ?? 0,
          ratingCount: (b as { ratingCount?: number }).ratingCount ?? 0,
          address: (b as { address?: string }).address ?? null,
        }
      : null,
    createdAt: s.createdAt,
  };
}

export const favoritesService = {
  async add(userId: string, businessId: string) {
    const business = await businessesRepository.findById(businessId);
    if (!business) throw new NotFoundError('Business not found');
    const saved = await favoritesRepository.upsert(userId, businessId);
    return toPublic(saved!);
  },

  async listMine(userId: string) {
    const saved = await favoritesRepository.listByUser(userId);
    return saved.map(toPublic);
  },

  async remove(userId: string, businessId: string) {
    await favoritesRepository.remove(userId, businessId);
    return { success: true };
  },
};
