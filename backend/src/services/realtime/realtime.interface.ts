/**
 * FlowOS - src/services/realtime/realtime.interface.ts
 * Contract for pushing real-time events to clients. Implemented by Socket.IO in
 * production and by a no-op in tests. Callers (queue/entry/appointment services)
 * depend on this interface, never on Socket.IO directly.
 */

export interface IRealtimeService {
  emitToUser(userId: string, event: string, payload: unknown): void;
  emitToQueue(queueId: string, event: string, payload: unknown): void;
  emitToBusiness(businessId: string, event: string, payload: unknown): void;
}

// Room name helpers — shared by the server-side emitter and the socket handlers.
export const room = {
  user: (id: string) => `user:${id}`,
  queue: (id: string) => `queue:${id}`,
  business: (id: string) => `business:${id}`,
};

// Canonical event names emitted to clients.
export const RT_EVENTS = {
  QUEUE_UPDATED: 'queue:updated',
  ENTRY_UPDATED: 'entry:updated',
  NOTIFICATION_NEW: 'notification:new',
  APPOINTMENT_UPDATED: 'appointment:updated',
  DASHBOARD_UPDATED: 'dashboard:updated',
} as const;

/**
 * Public queue lifecycle events (snake_case) broadcast to the `queue:<id>` room.
 * Clients treat these as "something changed" signals and refetch authoritative
 * state, except `queue_next` which also targets the called user's personal room.
 */
export const QUEUE_EVENTS = {
  JOINED: 'queue_joined',
  UPDATED: 'queue_updated',
  NEXT: 'queue_next',
  PAUSED: 'queue_paused',
  RESUMED: 'queue_resumed',
  COMPLETED: 'queue_completed',
} as const;
