/**
 * FlowOS - src/modules/auth/auth.routes.ts
 * Auth routes. Sensitive endpoints are rate-limited to slow brute-force attempts.
 * (Express 5 forwards async handler rejections to the error middleware automatically.)
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import * as controller from './auth.controller';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  verifyEmailSchema,
  resendOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.schema';

// Per-client brute-force guard. Keyed on req.ip, which resolves to the real
// device IP because `trust proxy` is set to Railway's hop count in app.ts — so
// the budget is per user/device, not shared across everyone behind the proxy.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts, try again later' } },
});

const router = Router();

router.post('/register', authLimiter, validate({ body: registerSchema }), controller.register);
router.post('/login', authLimiter, validate({ body: loginSchema }), controller.login);
router.post(
  '/verify-email',
  authLimiter,
  validate({ body: verifyEmailSchema }),
  controller.verifyEmail,
);
router.post('/resend-otp', authLimiter, validate({ body: resendOtpSchema }), controller.resendOtp);
router.post('/refresh', validate({ body: refreshSchema }), controller.refresh);
router.post('/logout', validate({ body: logoutSchema }), controller.logout);
router.post(
  '/forgot-password',
  authLimiter,
  validate({ body: forgotPasswordSchema }),
  controller.forgotPassword,
);
router.post(
  '/reset-password',
  authLimiter,
  validate({ body: resetPasswordSchema }),
  controller.resetPassword,
);
router.get('/me', authenticate, controller.me);

export default router;
