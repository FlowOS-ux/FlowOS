/**
 * FlowOS - src/modules/auth/auth.service.ts
 * Authentication business logic: registration, login, refresh-token rotation,
 * logout, and email-based password reset.
 */
import { randomBytes, randomInt } from 'node:crypto';
import { usersRepository, toPublicUser } from '../users/users.repository';
import type { UserDoc } from '../../models';
import { authRepository } from './auth.repository';
import { hashPassword, comparePassword, hashToken, compareToken } from '../../lib/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt';
import {
  ConflictError,
  UnauthorizedError,
  BadRequestError,
  EmailNotVerifiedError,
} from '../../lib/errors';
import { email as emailService } from '../../container';
import { env, isProd } from '../../config/env';
import { logger } from '../../lib/logger';
import type {
  RegisterDto,
  LoginDto,
  RefreshDto,
  LogoutDto,
  VerifyEmailDto,
  ResendOtpDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './auth.schema';

interface AuthResult {
  user: ReturnType<typeof toPublicUser>;
  accessToken: string;
  refreshToken: string;
}

interface RegisterResult {
  status: 'VERIFICATION_REQUIRED';
  email: string;
  /** Demo only (non-production): the plaintext code, so testers can self-verify. */
  devCode?: string;
}

const OTP_TTL_MS = 10 * 60 * 1000; // verification codes are valid for 10 minutes
const OTP_MAX_ATTEMPTS = 5;

/** A cryptographically-random, zero-padded 6-digit code. */
function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Issue a fresh verification OTP, persist its hash, email it, and return the code. */
async function sendVerificationOtp(user: UserDoc): Promise<string> {
  const otp = generateOtp();
  await usersRepository.updateById(user.id as string, {
    verifyOtpHash: await hashToken(otp),
    verifyOtpExpires: new Date(Date.now() + OTP_TTL_MS),
    verifyOtpAttempts: 0,
  });
  await emailService.send({
    to: user.email,
    subject: 'Your FlowOS verification code',
    text: `Welcome to FlowOS! Your verification code is ${otp}. It expires in 10 minutes.`,
  });
  logger.info({ userId: user.id }, 'verification OTP sent');
  return otp;
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
  /** Create the account (unverified) and email a verification code. No session yet. */
  async register(dto: RegisterDto): Promise<RegisterResult> {
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
    const otp = await sendVerificationOtp(user);
    // In non-production (demo/dev), return the code so testers can verify without email.
    return { status: 'VERIFICATION_REQUIRED', email: user.email, ...(isProd ? {} : { devCode: otp }) };
  },

  async login(dto: LoginDto, userAgent?: string): Promise<AuthResult> {
    const user = await usersRepository.findByEmailWithSecret(dto.email);
    if (!user || !(await comparePassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedError('Invalid email or password');
    }
    // Block unverified accounts, but (re)send a fresh code so the user can continue.
    if (!user.emailVerified) {
      const otp = await sendVerificationOtp(user);
      throw new EmailNotVerifiedError(undefined, isProd ? undefined : { devCode: otp });
    }
    const tokens = await issueTokens(user.id as string, user.role, userAgent);
    return { user: toPublicUser(user), ...tokens };
  },

  /** Verify the emailed OTP; on success mark verified and issue a session. */
  async verifyEmail(dto: VerifyEmailDto, userAgent?: string): Promise<AuthResult> {
    const user = await usersRepository.findByEmailForVerification(dto.email);
    if (!user) throw new BadRequestError('Invalid or expired code');
    if (user.emailVerified) {
      throw new BadRequestError('Email already verified — please log in');
    }
    if (
      !user.verifyOtpHash ||
      !user.verifyOtpExpires ||
      user.verifyOtpExpires.getTime() < Date.now()
    ) {
      throw new BadRequestError('Your code has expired — request a new one');
    }
    if ((user.verifyOtpAttempts ?? 0) >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestError('Too many incorrect attempts — request a new code');
    }
    if (!(await compareToken(dto.otp, user.verifyOtpHash))) {
      await usersRepository.updateById(user.id as string, { $inc: { verifyOtpAttempts: 1 } });
      throw new BadRequestError('Incorrect code');
    }

    const updated = await usersRepository.updateById(user.id as string, {
      emailVerified: true,
      $unset: { verifyOtpHash: 1, verifyOtpExpires: 1, verifyOtpAttempts: 1 },
    });
    const tokens = await issueTokens(user.id as string, user.role, userAgent);
    return { user: toPublicUser(updated ?? user), ...tokens };
  },

  /** Re-send a verification code. Always resolves (does not reveal account state). */
  async resendOtp(dto: ResendOtpDto): Promise<{ devCode?: string }> {
    const user = await usersRepository.findByEmailForVerification(dto.email);
    if (user && !user.emailVerified) {
      const otp = await sendVerificationOtp(user);
      if (!isProd) return { devCode: otp };
    }
    return {};
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
