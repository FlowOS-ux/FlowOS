/**
 * FlowOS mobile - src/storage/tokens.web.ts
 * Web fallback for token persistence (no Keychain on web). Resolved automatically
 * by the bundler's ".web.ts" extension priority in place of tokens.ts.
 * NOTE: localStorage is fine for local demo/dev; not for production secrets.
 */
// localStorage exists in the browser (web build) but isn't in the RN type lib.
type WebStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};
declare const localStorage: WebStorage;

const KEY = 'com.flowos.tokens';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  localStorage.setItem(KEY, JSON.stringify(tokens));
}

export async function loadTokens(): Promise<StoredTokens | null> {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredTokens;
  } catch {
    return null;
  }
}

export async function clearTokens(): Promise<void> {
  localStorage.removeItem(KEY);
}
