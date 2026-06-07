/**
 * FlowOS mobile - src/realtime/useQueueEvents.ts
 * Subscribe to one or more queue rooms and run `onChange` whenever any queue
 * lifecycle event arrives (or the socket (re)connects). Callers refetch their
 * authoritative state in onChange — the "signal then fetch" pattern.
 */
import { useEffect } from 'react';
import { getSocket, subscribeQueue, unsubscribeQueue, QUEUE_EVENT_NAMES } from './socket';

export function useQueueEvents(queueIds: string[], onChange: () => void): void {
  const key = queueIds.join(',');

  useEffect(() => {
    const socket = getSocket();
    if (!socket || queueIds.length === 0) return;

    queueIds.forEach(subscribeQueue);

    const handler = () => onChange();
    QUEUE_EVENT_NAMES.forEach((event) => socket.on(event, handler));
    // Refetch on (re)connect so we never miss events that fired while offline.
    socket.on('connect', handler);

    return () => {
      QUEUE_EVENT_NAMES.forEach((event) => socket.off(event, handler));
      socket.off('connect', handler);
      queueIds.forEach(unsubscribeQueue);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, onChange]);
}
