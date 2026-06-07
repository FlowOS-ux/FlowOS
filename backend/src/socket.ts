/**
 * FlowOS - src/socket.ts
 * Socket.IO server setup. Authenticates each connection with the same JWT used by
 * the REST API, then lets clients subscribe to queue/business rooms. Every socket
 * is auto-joined to its personal user room for targeted notifications.
 */
import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { env } from './config/env';
import { logger } from './lib/logger';
import { verifyAccessToken } from './lib/jwt';
import { room } from './services/realtime/realtime.interface';
import type { Role } from './types';

interface SocketAuthData {
  userId: string;
  role: Role;
}

export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','), credentials: true },
  });

  // Handshake auth: token may arrive via socket.handshake.auth.token or Authorization.
  io.use((socket, next) => {
    const raw =
      (socket.handshake.auth?.token as string | undefined) ??
      socket.handshake.headers.authorization?.replace('Bearer ', '');
    if (!raw) return next(new Error('UNAUTHORIZED'));
    try {
      const payload = verifyAccessToken(raw);
      (socket.data as SocketAuthData) = { userId: payload.sub, role: payload.role };
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket) => {
    const { userId } = socket.data as SocketAuthData;
    socket.join(room.user(userId));
    logger.debug({ userId, socketId: socket.id }, 'socket connected');

    // Clients subscribe/unsubscribe to live queue/business rooms.
    socket.on('subscribe:queue', (queueId: string) => socket.join(room.queue(queueId)));
    socket.on('unsubscribe:queue', (queueId: string) => socket.leave(room.queue(queueId)));
    socket.on('subscribe:business', (businessId: string) => socket.join(room.business(businessId)));
    socket.on('unsubscribe:business', (businessId: string) =>
      socket.leave(room.business(businessId)),
    );

    socket.on('disconnect', () => logger.debug({ userId }, 'socket disconnected'));
  });

  return io;
}
