/**
 * FlowOS - src/models/favorite.model.ts
 * Saved business ("Saved Places") — a user bookmarking a business.
 * Model: SavedBusiness | Collection: savedBusinesses
 */
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const savedBusinessSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  },
  { timestamps: true },
);

// A user saves a given business at most once.
savedBusinessSchema.index({ userId: 1, businessId: 1 }, { unique: true });

export type SavedBusinessDoc = HydratedDocument<InferSchemaType<typeof savedBusinessSchema>>;
export const SavedBusiness = model('SavedBusiness', savedBusinessSchema, 'savedBusinesses');
