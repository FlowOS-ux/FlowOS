/**
 * FlowOS mobile - src/api/health.ts
 * Lightweight, auth-free probe of the backend liveness endpoint. Used by the
 * connectivity layer to detect when a down backend (cold start / restart / DB
 * outage) is reachable again, so the app can recover on its own.
 */
import axios from 'axios';
import { SOCKET_URL } from '../config';

/** Returns true if the backend answered the health probe within `timeoutMs`. */
export async function pingHealth(timeoutMs = 8000): Promise<boolean> {
  try {
    // Root /health is a pure liveness probe (200 as soon as the process is up).
    await axios.get(`${SOCKET_URL}/health`, { timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}
