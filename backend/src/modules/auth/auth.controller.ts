/**
 * FlowOS - src/modules/auth/auth.controller.ts
 * HTTP handlers for auth. Validation happens in middleware; these delegate to the
 * service and shape the response.
 */
import type { Request, Response } from 'express';
import { authService } from './auth.service';
import { usersRepository, toPublicUser } from '../users/users.repository';
import { UnauthorizedError, NotFoundError } from '../../lib/errors';

export async function register(req: Request, res: Response): Promise<void> {
  const result = await authService.register(req.body);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = await authService.login(req.body, req.headers['user-agent']);
  res.json(result);
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const result = await authService.verifyEmail(req.body, req.headers['user-agent']);
  res.json(result);
}

export async function resendOtp(req: Request, res: Response): Promise<void> {
  const { devCode } = await authService.resendOtp(req.body);
  res.json({
    success: true,
    message: 'If the account exists and is unverified, a new code was sent',
    ...(devCode ? { devCode } : {}),
  });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const result = await authService.refresh(req.body, req.headers['user-agent']);
  res.json(result);
}

export async function logout(req: Request, res: Response): Promise<void> {
  await authService.logout(req.body);
  res.json({ success: true });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  await authService.forgotPassword(req.body);
  res.json({ success: true, message: 'If the email exists, a reset link has been sent' });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  await authService.resetPassword(req.body);
  res.json({ success: true, message: 'Password updated' });
}

/** GET /auth/me — current authenticated user. */
export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError();
  const user = await usersRepository.findById(req.user.id);
  if (!user) throw new NotFoundError('User not found');
  res.json({ user: toPublicUser(user) });
}
