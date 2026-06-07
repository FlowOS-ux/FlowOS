/**
 * FlowOS mobile - src/api/client.ts
 * Axios instance with a bearer-token request interceptor and a single-flight
 * refresh-on-401 response interceptor. Tokens live in memory here; AuthContext
 * persists them to the Keychain and registers callbacks.
 */
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../config';

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

export const api = axios.create({ baseURL: API_BASE_URL, timeout: 15000 });

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// Single-flight refresh so concurrent 401s trigger only one refresh call.
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshToken) return null;
  if (!refreshing) {
    refreshing = axios
      .post(`${API_BASE_URL}/auth/refresh`, { refreshToken })
      .then((res) => {
        const data = res.data as { accessToken: string; refreshToken: string };
        accessToken = data.accessToken;
        refreshToken = data.refreshToken;
        onTokensRefreshed?.(data.accessToken, data.refreshToken);
        return data.accessToken;
      })
      .catch(() => null)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const isAuthCall = original?.url?.includes('/auth/');

    if (error.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      const newAccess = await refreshAccessToken();
      if (newAccess) {
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      }
      onLogout?.();
    }
    return Promise.reject(error);
  },
);

/** Extract a human-readable message from an API error. */
export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: { message?: string } } | undefined;
    return data?.error?.message ?? err.message;
  }
  return err instanceof Error ? err.message : 'Something went wrong';
}
