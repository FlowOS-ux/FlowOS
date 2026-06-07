/**
 * FlowOS - src/modules/reviews/reviews.repository.ts
 * Data-access for reviews, including the rating aggregate used to keep
 * businesses.ratingAvg / ratingCount in sync.
 */
import { Types } from 'mongoose';
import { Review, type ReviewDoc } from '../../models';

export const reviewsRepository = {
  create(data: Record<string, unknown>): Promise<ReviewDoc> {
    return Review.create(data);
  },

  findById(id: string): Promise<ReviewDoc | null> {
    return Review.findById(id).exec();
  },

  listByBusiness(businessId: string): Promise<ReviewDoc[]> {
    return Review.find({ businessId, status: 'VISIBLE' })
      .sort({ createdAt: -1 })
      .populate('userId', 'name avatarUrl')
      .exec();
  },

  updateById(id: string, update: Record<string, unknown>): Promise<ReviewDoc | null> {
    return Review.findByIdAndUpdate(id, update, { new: true }).exec();
  },

  deleteById(id: string): Promise<unknown> {
    return Review.deleteOne({ _id: id }).exec();
  },

  /** Recompute average + count of VISIBLE reviews for a business. */
  async aggregateRating(businessId: string): Promise<{ avg: number; count: number }> {
    const result = await Review.aggregate<{ avg: number; count: number }>([
      { $match: { businessId: new Types.ObjectId(businessId), status: 'VISIBLE' } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    const row = result[0];
    return { avg: row ? Math.round(row.avg * 10) / 10 : 0, count: row?.count ?? 0 };
  },
};
