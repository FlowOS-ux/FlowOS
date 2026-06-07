/**
 * FlowOS - src/services/realtime/socket.realtime.ts
 * Socket.IO implementation of IRealtimeService. Emits events to user/queue/business
 * rooms. The Socket.IO server is created in server.ts and injected here.
 */
import type { Server } from 'socket.io';
import { type IRealtimeService, room } from './realtime.interface';
import { logger } from '../../lib/logger';

export class SocketRealtimeService implements IRealtimeService {
  constructor(private readonly io: Server) {}

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.io.to(room.user(userId)).emit(event, payload);
    logger.debug({ event, userId }, 'rt -> user');
  }

  emitToQueue(queueId: string, event: string, payload: unknown): void {
    this.io.to(room.queue(queueId)).emit(event, payload);
    logger.debug({ event, queueId }, 'rt -> queue');
  }

  emitToBusiness(businessId: string, event: string, payload: unknown): void {
    this.io.to(room.business(businessId)).emit(event, payload);
    logger.debug({ event, businessId }, 'rt -> business');
  }
}
