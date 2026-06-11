/**
 * FlowOS - src/server.ts
 * Boot sequence: create HTTP + Socket.IO -> start listening -> connect MongoDB
 * (with retry/backoff) in the background -> init async services. Handles graceful
 * shutdown.
 *
 * Why listen BEFORE the DB is ready: on a cold start / restart the container may
 * accept traffic before Atlas has finished connecting. If we waited for the DB to
 * connect before opening the port, the first client requests (typically login)
 * would hit a closed port and fail with a hard "Network Error" / ECONNREFUSED —
 * the exact symptom that "goes away on refresh" once the server is warm. By
 * opening the port first, those early requests queue on Mongoose's command buffer
 * and complete as soon as the connection is up (and surface a retryable 503 if it
 * isn't), instead of being refused outright.
 */
import { createServer } from 'node:http';
import dns from 'node:dns';
import { env } from './config/env';
import { logger } from './lib/logger';
import { connectDB, disconnectDB } from './config/db';
import { createApp } from './app';
import { createSocketServer } from './socket';
import { initRealtime, initServices } from './container';

// Prefer IPv4 when resolving hostnames. Some hosts (e.g. Railway) have no outbound
// IPv6 route, so resolving smtp.gmail.com to an AAAA record makes SMTP fail with
// ENETUNREACH. Setting this in code (not via NODE_OPTIONS) guarantees it applies,
// since `npx tsx` rewrites NODE_OPTIONS for its own loader and drops the flag.
dns.setDefaultResultOrder('ipv4first');

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Connect to MongoDB, retrying forever with exponential backoff (capped at 30s).
 * Never throws: a transient DB outage at boot should not crash the process — the
 * driver keeps retrying and Mongoose buffers queries until the connection is up.
 */
async function connectWithRetry(): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await connectDB();
      return;
    } catch (err) {
      const delay = Math.min(1000 * 2 ** (attempt - 1), 30000);
      logger.error({ err, attempt, delayMs: delay }, 'MongoDB connect failed; retrying');
      await sleep(delay);
    }
  }
}

async function bootstrap(): Promise<void> {
  // 1) HTTP + Socket.IO (no DB needed to stand these up).
  const app = createApp();
  const httpServer = createServer(app);
  const io = createSocketServer(httpServer);
  initRealtime(io); // upgrade realtime from no-op to Socket.IO

  // 2) Open the port immediately so the platform health check passes and early
  //    requests queue (instead of being refused) during the DB connect window.
  httpServer.listen(env.PORT, () => {
    logger.info(`FlowOS API listening on http://localhost:${env.PORT}${env.API_PREFIX}`);
  });

  // 3) Connect the DB (with retry) and init async services in the background.
  void connectWithRetry();
  void initServices().catch((err) => logger.error({ err }, 'initServices failed'));

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutting down...');
    io.close();
    httpServer.close();
    await disconnectDB().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  // Last-resort guards: log instead of letting an unhandled rejection take the
  // whole process down on a transient async failure.
  process.on('unhandledRejection', (reason) =>
    logger.error({ reason }, 'Unhandled promise rejection'),
  );
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Fatal boot error');
  process.exit(1);
});
