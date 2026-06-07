/**
 * FlowOS - src/lib/jwt.ts
 * Sign/verify JWT access & refresh tokens.
 */
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import type { AppJwtPayload, Role } from '../types';

export function signAccessToken(userId: string, role: Role): string {
  const payload: AppJwtPayload = { sub: userId, role };
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as SignOptions);
}

export function signRefreshToken(userId: string, role: Role): string {
  const payload: AppJwtPayload = { sub: userId, role };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AppJwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as AppJwtPayload;
}

export function verifyRefreshToken(token: string): AppJwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as AppJwtPayload;
}
