/**
 * FlowOS - src/services/realtime/noop.realtime.ts
 * No-op IRealtimeService. Used before Socket.IO is initialized and in tests.
 */
import type { IRealtimeService } from './realtime.interface';

export class NoopRealtimeService implements IRealtimeService {
  emitToUser(): void {}
  emitToQueue(): void {}
  emitToBusiness(): void {}
}
