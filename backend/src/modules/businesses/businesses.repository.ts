/**
 * FlowOS - src/modules/businesses/businesses.repository.ts
 * Data-access layer for businesses. Only layer that touches the Business model.
 */
import { type FilterQuery } from 'mongoose';
import { Business, type BusinessDoc } from '../../models';

export const businessesRepository = {
  create(data: Record<string, unknown>): Promise<BusinessDoc> {
    return Business.create(data);
  },

  findById(id: string): Promise<BusinessDoc | null> {
    return Business.findById(id).exec();
  },

  updateById(id: string, update: Record<string, unknown>): Promise<BusinessDoc | null> {
    return Business.findByIdAndUpdate(id, update, { new: true }).exec();
  },

  deleteById(id: string): Promise<unknown> {
    return Business.deleteOne({ _id: id }).exec();
  },

  listOwnedBy(ownerId: string): Promise<BusinessDoc[]> {
    return Business.find({ ownerId }).sort({ createdAt: -1 }).exec();
  },

  listByStatus(status: string): Promise<BusinessDoc[]> {
    return Business.find({ status }).sort({ updatedAt: -1 }).exec();
  },

  /** Admin views: businesses of a status with the owner's contact details populated. */
  listByStatusWithOwner(status: string): Promise<BusinessDoc[]> {
    return Business.find({ status })
      .populate('ownerId', 'name email phone')
      .sort({ createdAt: -1 })
      .exec();
  },

  async search(params: {
    filter: FilterQuery<BusinessDoc>;
    skip: number;
    limit: number;
    near?: { lng: number; lat: number; maxDistanceMeters: number };
  }): Promise<{ items: BusinessDoc[]; total: number }> {
    const { filter, skip, limit, near } = params;

    // $near can't be combined with countDocuments cleanly, so branch on geo.
    if (near) {
      const geoFilter: FilterQuery<BusinessDoc> = {
        ...filter,
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: [near.lng, near.lat] },
            $maxDistance: near.maxDistanceMeters,
          },
        },
      };
      const items = await Business.find(geoFilter).skip(skip).limit(limit).exec();
      return { items, total: items.length };
    }

    const [items, total] = await Promise.all([
      Business.find(filter).sort({ ratingAvg: -1, createdAt: -1 }).skip(skip).limit(limit).exec(),
      Business.countDocuments(filter).exec(),
    ]);
    return { items, total };
  },
};
