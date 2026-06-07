/**
 * FlowOS - src/modules/favorites/favorites.repository.ts
 * Data-access layer for saved businesses.
 */
import { SavedBusiness, type SavedBusinessDoc } from '../../models';

export const favoritesRepository = {
  upsert(userId: string, businessId: string): Promise<SavedBusinessDoc | null> {
    return SavedBusiness.findOneAndUpdate(
      { userId, businessId },
      { userId, businessId },
      { upsert: true, new: true },
    ).exec();
  },

  listByUser(userId: string): Promise<SavedBusinessDoc[]> {
    return SavedBusiness.find({ userId })
      .sort({ createdAt: -1 })
      .populate('businessId', 'name category logoUrl ratingAvg ratingCount address')
      .exec();
  },

  remove(userId: string, businessId: string): Promise<unknown> {
    return SavedBusiness.deleteOne({ userId, businessId }).exec();
  },
};
