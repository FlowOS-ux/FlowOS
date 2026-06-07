/**
 * FlowOS - src/models/refreshToken.model.ts
 * Persisted (hashed) refresh tokens — enables rotation, logout, and revocation.
 * Collection: refreshTokens
 */
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const refreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true }, // bcrypt hash of the raw token
    expiresAt: { type: Date, required: true },
    revoked: { type: Boolean, default: false },
    userAgent: { type: String },
  },
  { timestamps: true },
);

// TTL index: Mongo auto-removes expired token documents.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshTokenDoc = HydratedDocument<InferSchemaType<typeof refreshTokenSchema>>;
export const RefreshToken = model('RefreshToken', refreshTokenSchema, 'refreshTokens');
