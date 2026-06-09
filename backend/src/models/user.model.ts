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
    emailVerified: { type: Boolean, default: false },
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
    // Email verification OTP (hashed code + expiry + attempt counter); cleared once verified.
    verifyOtpHash: { type: String, select: false },
    verifyOtpExpires: { type: Date, select: false },
    verifyOtpAttempts: { type: Number, default: 0, select: false },
  },
  { timestamps: true },
);

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;
export const User = model('User', userSchema, 'users');
