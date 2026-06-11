/**
 * FlowOS - src/config/db.ts
 * Mongoose connection helper.
 *
 * Resilience notes (why the options below matter in a deployed environment):
 *  - serverSelectionTimeoutMS: fail fast (8s) instead of hanging the default 30s
 *    when Atlas is briefly unreachable, so a stuck request surfaces a retryable
 *    503 quickly rather than tying up a connection.
 *  - socket/connect timeouts + pool sizing: bound how long a single operation or
 *    a wait-for-a-pooled-connection can block, preventing slow-loris style hangs
 *    during a DB hiccup.
 *  - heartbeatFrequencyMS: detect a dropped primary faster so the driver's
 *    built-in auto-reconnect kicks in sooner.
 * The MongoDB driver auto-reconnects to the replica set on its own; we just log
 * the lifecycle so restarts/failovers are visible in production logs.
 */
import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../lib/logger';

mongoose.set('strictQuery', true);

// Attach lifecycle listeners exactly once (connectDB may be retried at boot).
let listenersAttached = false;
function attachConnectionListeners(): void {
  if (listenersAttached) return;
  listenersAttached = true;
  mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB connection error'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
}

export async function connectDB(uri: string = env.MONGODB_URI): Promise<typeof mongoose> {
  attachConnectionListeners();

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    waitQueueTimeoutMS: 10000,
    maxPoolSize: 10,
    minPoolSize: 1,
    heartbeatFrequencyMS: 10000,
    retryWrites: true,
  });
  return mongoose;
}

/** True when the connection is established and usable (readyState 1 = connected). */
export function isDbHealthy(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
