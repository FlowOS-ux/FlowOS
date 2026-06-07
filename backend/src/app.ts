/**
 * FlowOS - src/app.ts
 * Express application factory: security + parsing middleware, request logging,
 * static uploads, versioned API mount, and global 404 + error handlers.
 */
import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env';
import { logger } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/error';
import apiV1 from './api/v1';

export function createApp(): Application {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(pinoHttp({ logger }));

  // Serve locally-stored uploads (dev storage backend).
  app.use('/uploads', express.static(env.UPLOAD_DIR));

  // Liveness probe at the root (separate from versioned /system/health).
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // Versioned API.
  app.use(env.API_PREFIX, apiV1);

  // Fallbacks.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
