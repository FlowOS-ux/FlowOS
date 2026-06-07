/**
 * FlowOS - src/lib/logger.ts
 * Pino structured logger. Pretty-prints in dev when available, JSON in prod.
 */
import pino from 'pino';
import { env, isDev } from '../config/env';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : isDev ? 'debug' : 'info',
  // Redact common secret-bearing fields from logs.
  redact: ['req.headers.authorization', '*.password', '*.passwordHash', '*.token'],
});
