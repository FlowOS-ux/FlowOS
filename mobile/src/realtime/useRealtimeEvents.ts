/**
 * FlowOS mobile - src/realtime/useRealtimeEvents.ts
 * "Signal then fetch" hooks for personal and business real-time events, mirroring
 * useQueueEvents. Callers refetch authoritative state in onChange.
 */
import { useEffect } from 'react';
import {
  getSocket,
  subscribeBusiness,
  unsubscribeBusiness,
  NOTIFICATION_EVENT,
  DASHBOARD_EVENT,
} from './socket';

/**
 * Refetch whenever a `notification:new` arrives (or the socket (re)connects).
 * No room subscription needed — the backend auto-joins each socket to its
 * personal `user:<id>` room on connect.
 */
export function useNotificationEvents(onChange: () => void): void {
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handler = () => onChange();
    socket.on(NOTIFICATION_EVENT, handler);
    // Catch up on anything missed while offline.
    socket.on('connect', handler);

    return () => {
      socket.off(NOTIFICATION_EVENT, handler);
      socket.off('connect', handler);
    };
  }, [onChange]);
}

/**
 * Subscribe to one or more `business:<id>` rooms and refetch whenever a
 * `dashboard:updated` event arrives (or the socket (re)connects).
 */
export function useDashboardEvents(businessIds: string[], onChange: () => void): void {
  const key = businessIds.join(',');

  useEffect(() => {
    const socket = getSocket();
    if (!socket || businessIds.length === 0) return;

    businessIds.forEach(subscribeBusiness);

    const handler = () => onChange();
    socket.on(DASHBOARD_EVENT, handler);
    socket.on('connect', handler);

    return () => {
      socket.off(DASHBOARD_EVENT, handler);
      socket.off('connect', handler);
      businessIds.forEach(unsubscribeBusiness);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, onChange]);
}
