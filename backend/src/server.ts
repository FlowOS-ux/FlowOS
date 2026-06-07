/**
 * FlowOS - src/server.ts
 * Boot sequence: validate env -> connect MongoDB -> init services -> create HTTP
 * server -> attach Socket.IO -> listen. Handles graceful shutdown.
 */
import { createServer } from 'node:http';
import { env } from './config/env';
import { logger } from './lib/logger';
import { connectDB, disconnectDB } from './config/db';
import { createApp } from './app';
import { createSocketServer } from './socket';
import { initRealtime, initServices } from './container';

async function bootstrap(): Promise<void> {
  // 1) Database
  await connectDB();

  // 2) Async services (e.g. FCM)
  await initServices();

  // 3) HTTP + Socket.IO
  const app = createApp();
  const httpServer = createServer(app);
  const io = createSocketServer(httpServer);
  initRealtime(io); // upgrade realtime from no-op to Socket.IO

  httpServer.listen(env.PORT, () => {
    logger.info(`FlowOS API listening on http://localhost:${env.PORT}${env.API_PREFIX}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutting down...');
    io.close();
    httpServer.close();
    await disconnectDB();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Fatal boot error');
  process.exit(1);
});
