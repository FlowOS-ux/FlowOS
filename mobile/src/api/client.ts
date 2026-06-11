/**
 * FlowOS mobile - src/api/client.ts
 * Axios instance with:
 *   1. a bearer-token request interceptor,
 *   2. a single-flight refresh-on-401 response interceptor (network-aware — a
 *      network blip during refresh no longer logs the user out), and
 *   3. automatic retry with exponential backoff + jitter for TRANSIENT failures
 *      (no response / timeout / 502 / 503 / 504 / 429).
 *
 * (3) is the core fix for the intermittent "Network Error" on login/signup: a
 * cold-started or briefly-restarting backend would previously fail the very first
 * request, and only a manual refresh "fixed" it. Now those requests retry in the
 * background and recover on their own. Each outcome is reported to the connectivity
 * layer so the UI can show a "Reconnecting…" banner and refetch once we're back.
 *
 * Tokens live in memory here; AuthContext persists them to the Keychain and
 * registers callbacks.
 */
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, REQUEST_TIMEOUT_MS, MAX_RETRIES } from '../config';
import { reportSuccess, reportReconnecting, reportFailure } from '../net/connectivity';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let onTokensRefreshed: ((access: string, refresh: string) => void) | null = null;
let onLogout: (() => void) | null = null;

export function setAuthTokens(access: string | null, refresh: string | null): void {
  accessToken = access;
  refreshToken = refresh;
}

/** Current access token — used by the Socket.IO handshake. */
export function getAccessToken(): string | null {
  return accessToken;
}

export function registerAuthCallbacks(cb: {
  onTokensRefreshed: (access: string, refresh: string) => void;
  onLogout: () => void;
}): void {
  onTokensRefreshed = cb.onTokensRefreshed;
  onLogout = cb.onLogout;
}

export const api = axios.create({ baseURL: API_BASE_URL, timeout: REQUEST_TIMEOUT_MS });

// Per-request bookkeeping for the interceptors (auth retry + transient retry).
type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean; _retryCount?: number };

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// ---- Transient-failure detection + backoff -------------------------------------

const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** A "Network Error" (no HTTP response) or a retryable gateway/throttle status. */
function isTransient(error: AxiosError): boolean {
  if (error.code === 'ERR_CANCELED') return false; // caller aborted — don't retry
  if (!error.response) return true; // DNS fail / refused / CORS preflight / timeout / offline
  return RETRYABLE_STATUS.has(error.response.status);
}

/** Exponential backoff with jitter; honours a server `Retry-After` when present. */
function backoffDelay(attempt: number, error: AxiosError): number {
  const retryAfter = error.response?.headers?.['retry-after'];
  if (retryAfter != null) {
    const secs = Number(retryAfter);
    if (!Number.isNaN(secs)) return Math.min(secs * 1000, 20000);
  }
  const base = 500 * 2 ** attempt; // 500ms, 1s, 2s, ...
  return Math.min(base + Math.random() * 0.3 * base, 8000);
}

// ---- Single-flight, network-aware token refresh --------------------------------

type RefreshResult =
  | { status: 'ok'; token: string }
  | { status: 'auth_failed' } // refresh token genuinely invalid/expired → log out
  | { status: 'network_error' }; // couldn't reach the server → keep the session, surface error

let refreshing: Promise<RefreshResult> | null = null;

async function refreshAccessToken(): Promise<RefreshResult> {
  if (!refreshToken) return { status: 'auth_failed' };
  if (!refreshing) {
    refreshing = (async (): Promise<RefreshResult> => {
      try {
        // Route through `api` so the refresh call ALSO benefits from transient retry.
        const res = await api.post('/auth/refresh', { refreshToken });
        const data = res.data as { accessToken: string; refreshToken: string };
        accessToken = data.accessToken;
        refreshToken = data.refreshToken;
        onTokensRefreshed?.(data.accessToken, data.refreshToken);
        return { status: 'ok', token: data.accessToken };
      } catch (err) {
        // No HTTP response => couldn't reach the server. Do NOT log the user out
        // for a transient network failure; let the original request surface it.
        if (axios.isAxiosError(err) && !err.response) return { status: 'network_error' };
        return { status: 'auth_failed' };
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

api.interceptors.response.use(
  (res) => {
    reportSuccess();
    return res;
  },
  async (error: AxiosError) => {
    const original = error.config as RetryConfig | undefined;
    const isAuthCall = original?.url?.includes('/auth/');

    // (a) Expired access token → silent refresh, then replay the original request once.
    //     Skipped for /auth/* calls to avoid refresh recursion (login/refresh itself).
    if (error.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      const result = await refreshAccessToken();
      if (result.status === 'ok') {
        original.headers.Authorization = `Bearer ${result.token}`;
        return api(original);
      }
      if (result.status === 'auth_failed') {
        onLogout?.();
        return Promise.reject(error);
      }
      // network_error → fall through to transient retry below.
    }

    // (b) Transient failure (cold start, restart, blip, gateway, throttle) → retry
    //     with exponential backoff. Safe for POST login/register too: a request with
    //     no response never reached the server, so replaying it can't double-apply.
    if (original && isTransient(error) && (original._retryCount ?? 0) < MAX_RETRIES) {
      original._retryCount = (original._retryCount ?? 0) + 1;
      reportReconnecting();
      await sleep(backoffDelay(original._retryCount - 1, error));
      return api(original);
    }

    // (c) Give up: report a hard failure so the UI can show an offline state.
    if (isTransient(error)) reportFailure();
    return Promise.reject(error);
  },
);

/** Extract the machine-readable error code (e.g. 'EMAIL_NOT_VERIFIED') when present. */
export function apiErrorCode(err: unknown): string | undefined {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: { code?: string } } | undefined;
    return data?.error?.code;
  }
  return undefined;
}

/** Demo-mode verification code returned in an error's details (non-production backend). */
export function apiErrorDevCode(err: unknown): string | undefined {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: { details?: { devCode?: string } } } | undefined;
    return data?.error?.details?.devCode;
  }
  return undefined;
}

/** True when the failure is a connectivity problem (no response) rather than an API error. */
export function isNetworkError(err: unknown): boolean {
  return axios.isAxiosError(err) && !err.response && err.code !== 'ERR_CANCELED';
}

/** Extract a human-readable message from an API error. */
export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    // Connectivity failures (no response): give an actionable, non-scary message
    // instead of axios's raw "Network Error" / "timeout of 15000ms exceeded".
    if (!err.response) {
      if (err.code === 'ECONNABORTED') {
        return 'The server is taking too long to respond. Please check your connection and try again.';
      }
      return "Can't reach the server. Check your internet connection and try again.";
    }

    if (err.response.status === 503) {
      return 'The service is starting up or temporarily busy. Please try again in a moment.';
    }

    const data = err.response.data as
      | { error?: { message?: string; details?: unknown } }
      | undefined;

    // Surface the first field-level validation issue when present
    // (e.g. zod: "password: Too small ...") instead of a generic "Validation failed".
    const details = data?.error?.details;
    if (Array.isArray(details) && details.length > 0) {
      const first = details[0] as { message?: string; path?: Array<string | number> };
      if (first?.message) {
        const field =
          Array.isArray(first.path) && first.path.length > 0
            ? first.path[first.path.length - 1]
            : undefined;
        return field ? `${field}: ${first.message}` : first.message;
      }
    }

    return data?.error?.message ?? err.message;
  }
  return err instanceof Error ? err.message : 'Something went wrong';
}
