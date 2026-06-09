/**
 * FlowOS - src/models/business.model.ts
 * Business/venue: profile, category, geo location, hours, status, rating aggregates.
 * Collection: businesses
 */
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { BUSINESS_STATUSES } from '../types';

const businessHourSchema = new Schema(
  {
    dayOfWeek: { type: Number, min: 0, max: 6, required: true }, // 0 = Sunday
    openTime: { type: String }, // "09:00"
    closeTime: { type: String }, // "17:00"
    isClosed: { type: Boolean, default: false },
  },
  { _id: false },
);

const businessSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    category: { type: String, required: true, index: true }, // references categories.key
    description: { type: String },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    address: { type: String },
    // GeoJSON point for "near me" Explore queries.
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
    },
    phone: { type: String },
    logoUrl: { type: String },
    hours: { type: [businessHourSchema], default: [] },
    status: { type: String, enum: BUSINESS_STATUSES, default: 'DRAFT', index: true },
    // Set by an admin when a verification review is rejected; shown back to the owner.
    rejectionReason: { type: String },
    // Denormalized rating aggregates (maintained by the reviews service).
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

businessSchema.index({ location: '2dsphere' });
businessSchema.index({ name: 'text', description: 'text' });

export type BusinessDoc = HydratedDocument<InferSchemaType<typeof businessSchema>>;
export const Business = model('Business', businessSchema, 'businesses');
