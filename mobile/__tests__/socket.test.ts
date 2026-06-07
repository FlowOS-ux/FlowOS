/**
 * FlowOS mobile - __tests__/socket.test.ts
 * Realtime manager: event-name contract (must match backend) + safe no-ops before
 * a socket exists. Covers the Phase 2A business-room additions.
 */
import {
  NOTIFICATION_EVENT,
  DASHBOARD_EVENT,
  QUEUE_EVENT_NAMES,
  getSocket,
  isConnected,
  subscribeQueue,
  unsubscribeQueue,
  subscribeBusiness,
  unsubscribeBusiness,
} from '../src/realtime/socket';

describe('realtime socket manager', () => {
  it('exposes canonical event names matching the backend', () => {
    expect(NOTIFICATION_EVENT).toBe('notification:new');
    expect(DASHBOARD_EVENT).toBe('dashboard:updated');
    expect(QUEUE_EVENT_NAMES).toEqual(
      expect.arrayContaining(['queue_joined', 'queue_next', 'queue_completed']),
    );
  });

  it('reports disconnected before connect', () => {
    expect(getSocket()).toBeNull();
    expect(isConnected()).toBe(false);
  });

  it('room subscribe/unsubscribe are safe no-ops without a socket', () => {
    expect(() => {
      subscribeQueue('q1');
      unsubscribeQueue('q1');
      subscribeBusiness('b1');
      unsubscribeBusiness('b1');
    }).not.toThrow();
  });
});
