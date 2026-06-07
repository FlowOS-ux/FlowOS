/**
 * FlowOS - src/models/user.model.ts
 * User account: authentication, profile, settings, and global platform role.
 * Collection: users
 */
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { ROLES } from '../types';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    phone: { type: String, trim: true },
    avatarUrl: { type: String },
    role: { type: String, enum: ROLES, default: 'CUSTOMER', index: true },
    onboardingComplete: { type: Boolean, default: false },
    settings: {
      language: { type: String, default: 'en' },
      notificationsEnabled: { type: Boolean, default: true },
      pushEnabled: { type: Boolean, default: true },
      emailEnabled: { type: Boolean, default: true },
    },
    // Password reset (hashed token + expiry); cleared after use.
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },
  },
  { timestamps: true },
);

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;
export const User = model('User', userSchema, 'users');
