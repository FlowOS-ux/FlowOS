/**
 * FlowOS - src/modules/reviews/reviews.service.ts
 * Create/update/delete reviews and keep the business rating aggregates in sync.
 */
import { reviewsRepository } from './reviews.repository';
import { businessesRepository } from '../businesses/businesses.repository';
import { AnalyticsEvent, type ReviewDoc } from '../../models';
import { ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import type { CreateReviewDto, UpdateReviewDto } from './reviews.schema';

function toPublic(r: ReviewDoc) {
  const u = r.userId as unknown as { name?: string; avatarUrl?: string } | null;
  return {
    id: r.id as string,
    businessId: String(r.businessId),
    rating: r.rating,
    comment: r.comment ?? null,
    author: u && typeof u === 'object' && 'name' in u ? { name: u.name, avatarUrl: u.avatarUrl } : null,
    createdAt: r.createdAt,
  };
}

async function syncBusinessRating(businessId: string): Promise<void> {
  const { avg, count } = await reviewsRepository.aggregateRating(businessId);
  await businessesRepository.updateById(businessId, { ratingAvg: avg, ratingCount: count });
}

export const reviewsService = {
  async create(userId: string, businessId: string, dto: CreateReviewDto) {
    const business = await businessesRepository.findById(businessId);
    if (!business) throw new NotFoundError('Business not found');

    let review: ReviewDoc;
    try {
      review = await reviewsRepository.create({ businessId, userId, ...dto });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        throw new ConflictError('You have already reviewed this business');
      }
      throw err;
    }

    await syncBusinessRating(businessId);
    try {
      await AnalyticsEvent.create({
        type: 'REVIEW_CREATED',
        businessId,
        userId,
      } as Record<string, unknown>);
    } catch (err) {
      logger.error({ err }, 'failed to log review analytics');
    }

    return toPublic(review);
  },

  async listForBusiness(businessId: string) {
    const reviews = await reviewsRepository.listByBusiness(businessId);
    return reviews.map(toPublic);
  },

  async update(userId: string, id: string, dto: UpdateReviewDto) {
    const review = await reviewsRepository.findById(id);
    if (!review) throw new NotFoundError('Review not found');
    if (String(review.userId) !== userId) throw new ForbiddenError('Not your review');

    const updated = await reviewsRepository.updateById(id, dto);
    await syncBusinessRating(String(review.businessId));
    return toPublic(updated!);
  },

  async remove(userId: string, id: string) {
    const review = await reviewsRepository.findById(id);
    if (!review) throw new NotFoundError('Review not found');
    if (String(review.userId) !== userId) throw new ForbiddenError('Not your review');

    await reviewsRepository.deleteById(id);
    await syncBusinessRating(String(review.businessId));
    return { success: true };
  },
};
