/**
 * FlowOS mobile - src/net/connectivity.ts
 * App-wide connectivity state machine. The API client reports request outcomes
 * here; the UI subscribes to show a "Reconnecting…" banner and to refetch data
 * automatically once the backend comes back — so users recover WITHOUT a manual
 * page/app refresh.
 *
 * States:
 *   online        - last request succeeded (or we have no reason to think we're down)
 *   reconnecting   - a request is failing and being retried in the background
 *   offline        - retries were exhausted / the device reports no connection
 *
 * This module has no native dependency: on web it also listens to the browser's
 * online/offline events; on native it relies on request outcomes + health polling.
 */
import { Platform } from 'react-native';
import { pingHealth } from '../api/health';

export type NetState = 'online' | 'reconnecting' | 'offline';

let state: NetState = 'online';
const stateListeners = new Set<(s: NetState) => void>();
const recoveryListeners = new Set<() => void>();
let pollTimer: ReturnType<typeof setTimeout> | null = null;

function emitState(): void {
  stateListeners.forEach((l) => l(state));
}

function setState(next: NetState): void {
  if (next === state) return;
  const wasDown = state !== 'online';
  state = next;
  emitState();
  // Transitioned back to healthy after being down → fire recovery so screens refetch.
  if (next === 'online' && wasDown) {
    recoveryListeners.forEach((l) => l());
    stopPolling();
  }
  if (next === 'offline') startPolling();
}

/** A request (or the health probe) succeeded — we're online. */
export function reportSuccess(): void {
  setState('online');
}

/** A request failed but is being retried — show a soft "reconnecting" state. */
export function reportReconnecting(): void {
  // Don't downgrade a confirmed "offline" to "reconnecting"; let recovery decide.
  if (state === 'offline') return;
  setState('reconnecting');
}

/** Retries were exhausted / the request gave up — we're offline until proven otherwise. */
export function reportFailure(): void {
  setState('offline');
}

export function getNetState(): NetState {
  return state;
}

/** Subscribe to state changes. Returns an unsubscribe fn. */
export function subscribeNetState(listener: (s: NetState) => void): () => void {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}

/** Fires once each time we recover from a down state. Use it to refetch screen data. */
export function onRecovered(listener: () => void): () => void {
  recoveryListeners.add(listener);
  return () => recoveryListeners.delete(listener);
}

// While we believe we're offline, quietly poll the health endpoint so the app can
// recover on its own the moment the backend (e.g. a cold-started Railway dyno or a
// restarted DB) is reachable again — even if the user isn't actively interacting.
function startPolling(): void {
  if (pollTimer) return;
  const tick = async (): Promise<void> => {
    if (state === 'online') return stopPolling();
    const ok = await pingHealth();
    if (ok) {
      reportSuccess();
      return;
    }
    pollTimer = setTimeout(() => void tick(), 4000);
  };
  pollTimer = setTimeout(() => void tick(), 4000);
}

function stopPolling(): void {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

// Web: react to the browser's own connectivity signals immediately.
// Access `window` via globalThis so we don't depend on the DOM type lib (RN).
const webWindow = (globalThis as { window?: { addEventListener?: (t: string, cb: () => void) => void } })
  .window;
if (Platform.OS === 'web' && webWindow && typeof webWindow.addEventListener === 'function') {
  webWindow.addEventListener('offline', () => setState('offline'));
  webWindow.addEventListener('online', () => {
    // The OS says we're back; confirm the backend is actually reachable.
    void pingHealth().then((ok) => (ok ? reportSuccess() : startPolling()));
  });
}
