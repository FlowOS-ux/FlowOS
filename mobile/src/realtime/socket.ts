/**
 * FlowOS mobile - src/realtime/socket.ts
 * Singleton Socket.IO client manager.
 *
 * - Connects with the JWT access token in the handshake (matches backend auth).
 * - Tracks subscribed queue rooms and RE-SUBSCRIBES automatically after every
 *   (re)connect, since server-side room membership is lost on disconnect.
 * - Refreshes the auth token before each reconnect attempt (tokens rotate).
 * - Exposes connection-status listeners for "live / reconnecting" UI.
 */
import { io, type Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config';
import { getAccessToken } from '../api/client';

/** Server -> client queue lifecycle events (must match backend QUEUE_EVENTS). */
export const QUEUE_EVENT_NAMES = [
  'queue_joined',
  'queue_updated',
  'queue_next',
  'queue_paused',
  'queue_resumed',
  'queue_completed',
] as const;

/** Personal/business events (must match backend RT_EVENTS). */
export const NOTIFICATION_EVENT = 'notification:new';
export const DASHBOARD_EVENT = 'dashboard:updated';

let socket: Socket | null = null;
const subscribedQueues = new Set<string>();
const subscribedBusinesses = new Set<string>();
type StatusListener = (connected: boolean) => void;
const statusListeners = new Set<StatusListener>();

function notifyStatus(connected: boolean): void {
  statusListeners.forEach((l) => l(connected));
}

export function connectSocket(): Socket {
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    auth: { token: getAccessToken() ?? '' },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    // Re-join every room we care about after a fresh connection.
    subscribedQueues.forEach((id) => socket?.emit('subscribe:queue', id));
    subscribedBusinesses.forEach((id) => socket?.emit('subscribe:business', id));
    notifyStatus(true);
  });
  socket.on('disconnect', () => notifyStatus(false));

  // Use the latest (possibly refreshed) token on each reconnect attempt.
  socket.io.on('reconnect_attempt', () => {
    if (socket) socket.auth = { token: getAccessToken() ?? '' };
  });

  return socket;
}

export function disconnectSocket(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  subscribedQueues.clear();
  subscribedBusinesses.clear();
}

export function getSocket(): Socket | null {
  return socket;
}

export function isConnected(): boolean {
  return !!socket?.connected;
}

export function subscribeQueue(queueId: string): void {
  subscribedQueues.add(queueId);
  socket?.emit('subscribe:queue', queueId);
}

export function unsubscribeQueue(queueId: string): void {
  subscribedQueues.delete(queueId);
  socket?.emit('unsubscribe:queue', queueId);
}

export function subscribeBusiness(businessId: string): void {
  subscribedBusinesses.add(businessId);
  socket?.emit('subscribe:business', businessId);
}

export function unsubscribeBusiness(businessId: string): void {
  subscribedBusinesses.delete(businessId);
  socket?.emit('unsubscribe:business', businessId);
}

export function onConnectionChange(listener: StatusListener): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}
