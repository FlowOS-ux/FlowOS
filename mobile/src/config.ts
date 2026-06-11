/**
 * FlowOS mobile - src/config.ts
 * Runtime configuration.
 *
 * In dev (Metro), the backend is reached on the local machine:
 *   - Android emulator -> 10.0.2.2  (the host's loopback alias)
 *   - iOS simulator    -> localhost
 *
 * In a release build (__DEV__ === false) — the shared APK or the deployed web
 * client (`npm run web:build`) — the app talks to the backend deployed on Render.
 *
 * NOTE: if Render assigns a suffixed service URL (name already taken), update
 * PUBLIC_BASE_URL below and rebuild (web build + APK).
 */
import { Platform } from 'react-native';

// Public HTTPS endpoint for shared/release builds (Render web service).
const PUBLIC_BASE_URL = 'https://flowos-backend.onrender.com';

const devBase = Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';

const BASE_URL = __DEV__ ? devBase : PUBLIC_BASE_URL;

export const API_BASE_URL = `${BASE_URL}/api/v1`;
export const SOCKET_URL = BASE_URL;
// Origin used to resolve relative image paths (e.g. "/uploads/x.png") returned by
// the media API, so uploaded images load over whatever host the app is using.
export const MEDIA_BASE_URL = BASE_URL;

// --- Network resilience tuning --------------------------------------------------
// Per-attempt request timeout. Render's free tier sleeps after ~15 min idle and
// takes 30–60 s to wake, during which requests are held by the platform — so the
// first request after idle needs a generous timeout to ride out the cold start.
export const REQUEST_TIMEOUT_MS = 60000;
// Max automatic retries for transient failures (network error / timeout / 5xx /
// 429), on top of the initial attempt. With exponential backoff this gives the
// backend up to ~tens of seconds to wake from a cold start before we give up.
export const MAX_RETRIES = 3;
