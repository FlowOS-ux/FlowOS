/**
 * FlowOS - src/modules/auth/auth.repository.ts
 * Data-access layer for refresh tokens (rotation, lookup, revocation).
 */
import { RefreshToken, type RefreshTokenDoc } from '../../models';

export const authRepository = {
  createRefreshToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string;
  }): Promise<RefreshTokenDoc> {
    return RefreshToken.create(input);
  },

  findActiveByUser(userId: string): Promise<RefreshTokenDoc[]> {
    return RefreshToken.find({ userId, revoked: false, expiresAt: { $gt: new Date() } }).exec();
  },

  revokeById(id: string): Promise<RefreshTokenDoc | null> {
    return RefreshToken.findByIdAndUpdate(id, { revoked: true }, { new: true }).exec();
  },

  revokeAllForUser(userId: string): Promise<unknown> {
    return RefreshToken.updateMany({ userId, revoked: false }, { revoked: true }).exec();
  },
};
