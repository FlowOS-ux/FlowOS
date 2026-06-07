/**
 * FlowOS - src/modules/auth/auth.service.ts
 * Authentication business logic: registration, login, refresh-token rotation,
 * logout, and email-based password reset.
 */
import { randomBytes } from 'node:crypto';
import { usersRepository, toPublicUser } from '../users/users.repository';
import { authRepository } from './auth.repository';
import { hashPassword, comparePassword, hashToken, compareToken } from '../../lib/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt';
import { ConflictError, UnauthorizedError, BadRequestError } from '../../lib/errors';
import { email as emailService } from '../../container';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import type {
  RegisterDto,
  LoginDto,
  RefreshDto,
  LogoutDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './auth.schema';

interface AuthResult {
  user: ReturnType<typeof toPublicUser>;
  accessToken: string;
  refreshToken: string;
}

/** Parse a JWT-style duration ("15m", "7d") into milliseconds. */
function parseDurationMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) return 0;
  const n = Number(match[1]);
  const unit = match[2];
  const factor = unit === 's' ? 1e3 : unit === 'm' ? 6e4 : unit === 'h' ? 36e5 : 864e5;
  return n * factor;
}

async function issueTokens(
  userId: string,
  role: Parameters<typeof signAccessToken>[1],
  userAgent?: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = signAccessToken(userId, role);
  const refreshToken = signRefreshToken(userId, role);
  await authRepository.createRefreshToken({
    userId,
    tokenHash: await hashToken(refreshToken),
    expiresAt: new Date(Date.now() + parseDurationMs(env.JWT_REFRESH_EXPIRES_IN)),
    userAgent,
  });
  return { accessToken, refreshToken };
}

export const authService = {
  async register(dto: RegisterDto, userAgent?: string): Promise<AuthResult> {
    if (await usersRepository.existsByEmail(dto.email)) {
      throw new ConflictError('An account with this email already exists');
    }
    const user = await usersRepository.create({
      name: dto.name,
      email: dto.email,
      passwordHash: await hashPassword(dto.password),
      role: dto.role,
      phone: dto.phone,
    });
    const tokens = await issueTokens(user.id as string, user.role, userAgent);
    return { user: toPublicUser(user), ...tokens };
  },

  async login(dto: LoginDto, userAgent?: string): Promise<AuthResult> {
    const user = await usersRepository.findByEmailWithSecret(dto.email);
    if (!user || !(await comparePassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedError('Invalid email or password');
    }
    const tokens = await issueTokens(user.id as string, user.role, userAgent);
    return { user: toPublicUser(user), ...tokens };
  },

  /** Rotate: validate the presented refresh token, revoke it, issue a fresh pair. */
  async refresh(dto: RefreshDto, userAgent?: string): Promise<AuthResult> {
    let payload: ReturnType<typeof verifyRefreshToken>;
    try {
      payload = verifyRefreshToken(dto.refreshToken);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const active = await authRepository.findActiveByUser(payload.sub);
    let matched = null;
    for (const token of active) {
      if (await compareToken(dto.refreshToken, token.tokenHash)) {
        matched = token;
        break;
      }
    }
    if (!matched) throw new UnauthorizedError('Refresh token has been revoked');

    await authRepository.revokeById(matched.id as string);

    const user = await usersRepository.findById(payload.sub);
    if (!user) throw new UnauthorizedError('User no longer exists');

    const tokens = await issueTokens(user.id as string, user.role, userAgent);
    return { user: toPublicUser(user), ...tokens };
  },

  async logout(dto: LogoutDto): Promise<void> {
    try {
      const payload = verifyRefreshToken(dto.refreshToken);
      const active = await authRepository.findActiveByUser(payload.sub);
      for (const token of active) {
        if (await compareToken(dto.refreshToken, token.tokenHash)) {
          await authRepository.revokeById(token.id as string);
          break;
        }
      }
    } catch {
      // Idempotent: an invalid/expired token is already "logged out".
    }
  },

  /** Always resolves (never reveals whether the email exists). */
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await usersRepository.findByEmailWithSecret(dto.email);
    if (!user) return;

    const raw = randomBytes(32).toString('hex');
    await usersRepository.updateById(user.id as string, {
      resetTokenHash: await hashToken(raw),
      resetTokenExpires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    });

    const token = `${user.id}.${raw}`;
    await emailService.send({
      to: user.email,
      subject: 'Reset your FlowOS password',
      text: `Use this token to reset your password (valid 1 hour): ${token}`,
    });
    logger.info({ userId: user.id }, 'password reset requested');
  },

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const sep = dto.token.indexOf('.');
    if (sep < 0) throw new BadRequestError('Malformed reset token');
    const userId = dto.token.slice(0, sep);
    const raw = dto.token.slice(sep + 1);

    const user = await usersRepository.findByIdWithSecret(userId);
    if (
      !user ||
      !user.resetTokenHash ||
      !user.resetTokenExpires ||
      user.resetTokenExpires.getTime() < Date.now() ||
      !(await compareToken(raw, user.resetTokenHash))
    ) {
      throw new BadRequestError('Invalid or expired reset token');
    }

    await usersRepository.updateById(userId, {
      passwordHash: await hashPassword(dto.password),
      $unset: { resetTokenHash: 1, resetTokenExpires: 1 },
    });
    // Force re-login everywhere after a password change.
    await authRepository.revokeAllForUser(userId);
  },
};
