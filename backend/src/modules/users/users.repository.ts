/**
 * FlowOS - src/modules/users/users.repository.ts
 * Data-access layer for users. The only layer that touches the User model.
 */
import { User, type UserDoc } from '../../models';
import type { Role } from '../../types';

export interface CreateUserInput {
  name: string;
  email: string;
  passwordHash: string;
  role?: Role;
  phone?: string;
}

export const usersRepository = {
  findById(id: string): Promise<UserDoc | null> {
    return User.findById(id).exec();
  },

  /** Includes passwordHash + reset fields (normally `select: false`). */
  findByEmailWithSecret(email: string): Promise<UserDoc | null> {
    return User.findOne({ email: email.toLowerCase() })
      .select('+passwordHash +resetTokenHash +resetTokenExpires')
      .exec();
  },

  findByIdWithSecret(id: string): Promise<UserDoc | null> {
    return User.findById(id).select('+passwordHash +resetTokenHash +resetTokenExpires').exec();
  },

  /** Includes the email-verification OTP fields (normally `select: false`). */
  findByEmailForVerification(email: string): Promise<UserDoc | null> {
    return User.findOne({ email: email.toLowerCase() })
      .select('+verifyOtpHash +verifyOtpExpires +verifyOtpAttempts')
      .exec();
  },

  existsByEmail(email: string): Promise<boolean> {
    return User.exists({ email: email.toLowerCase() }).then((r) => Boolean(r));
  },

  create(input: CreateUserInput): Promise<UserDoc> {
    return User.create(input);
  },

  updateById(id: string, update: Record<string, unknown>): Promise<UserDoc | null> {
    return User.findByIdAndUpdate(id, update, { new: true }).exec();
  },
};

/** Public projection of a user — safe to return in API responses. */
export function toPublicUser(user: UserDoc) {
  return {
    id: user.id as string,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    phone: user.phone ?? null,
    avatarUrl: user.avatarUrl ?? null,
    onboardingComplete: user.onboardingComplete,
    settings: user.settings,
    createdAt: user.createdAt,
  };
}
