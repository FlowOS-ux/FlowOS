/**
 * FlowOS - src/middleware/error.ts
 * Central error handler. Translates thrown errors into a consistent JSON envelope:
 *   { error: { code, message, details? } }
 */
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';
import { isProd } from '../config/env';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Route not found: ${req.method} ${req.originalUrl}` },
  });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  // Known, operational application errors.
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  // Zod validation errors that reached here unwrapped.
  if (err instanceof ZodError) {
    res.status(422).json({
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: err.issues },
    });
    return;
  }

  // Mongoose duplicate-key error.
  if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
    res.status(409).json({
      error: { code: 'CONFLICT', message: 'A record with these details already exists' },
    });
    return;
  }

  // Database temporarily unavailable (connection dropped, primary stepped down,
  // server-selection timed out). These are transient: respond 503 so the client's
  // retry-with-backoff can recover instead of treating it as a hard failure.
  const errName = (err as { name?: string } | null)?.name ?? '';
  if (
    errName === 'MongooseServerSelectionError' ||
    errName === 'MongoServerSelectionError' ||
    errName === 'MongoNetworkError' ||
    errName === 'MongoNotConnectedError' ||
    errName === 'MongoTimeoutError'
  ) {
    logger.warn({ err }, 'Database unavailable; returning 503');
    res.status(503).json({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service temporarily unavailable, please try again',
      },
    });
    return;
  }

  // Unknown / programmer errors.
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isProd ? 'Something went wrong' : String((err as Error)?.message ?? err),
    },
  });
}
