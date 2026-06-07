/**
 * FlowOS - src/models/review.model.ts
 * Rating + review of a business by a user. Drives business rating aggregates.
 * Collection: reviews
 */
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { REVIEW_STATUSES } from '../types';

const reviewSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true },
    status: { type: String, enum: REVIEW_STATUSES, default: 'VISIBLE' },
  },
  { timestamps: true },
);

// One review per user per business.
reviewSchema.index({ userId: 1, businessId: 1 }, { unique: true });

export type ReviewDoc = HydratedDocument<InferSchemaType<typeof reviewSchema>>;
export const Review = model('Review', reviewSchema, 'reviews');
