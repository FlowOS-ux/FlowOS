/**
 * FlowOS - src/models/category.model.ts
 * Reference list of business categories (Explore filters).
 * Collection: categories
 */
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const categorySchema = new Schema(
  {
    key: { type: String, required: true, unique: true }, // e.g. "HOSPITAL"
    label: { type: String, required: true }, // e.g. "Hospital"
    icon: { type: String },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type CategoryDoc = HydratedDocument<InferSchemaType<typeof categorySchema>>;
export const Category = model('Category', categorySchema, 'categories');
