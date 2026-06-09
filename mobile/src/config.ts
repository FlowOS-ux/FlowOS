/**
 * FlowOS mobile - src/config.ts
 * Runtime configuration.
 *
 * In dev (Metro), the backend is reached on the local machine:
 *   - Android emulator -> 10.0.2.2  (the host's loopback alias)
 *   - iOS simulator    -> localhost
 *
 * In a release build (__DEV__ === false) — e.g. a shared APK — the app talks to
 * the backend over the PUBLIC INTERNET via a Cloudflare tunnel, so testers on
 * ANY network can use it. The tunnel is started with:
 *   cloudflared tunnel --url http://localhost:4000
 *
 * NOTE: a free "quick" tunnel URL changes every time cloudflared restarts. If it
 * changes, update PUBLIC_BASE_URL below and rebuild the APK. For a permanent URL,
 * use a named Cloudflare tunnel (free account + domain) or deploy the backend.
 */
import { Platform } from 'react-native';

// Public HTTPS endpoint for shared/release builds (Cloudflare quick tunnel).
const PUBLIC_BASE_URL = 'https://journalist-mega-oops-demographic.trycloudflare.com';

const devBase = Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';

const BASE_URL = __DEV__ ? devBase : PUBLIC_BASE_URL;

export const API_BASE_URL = `${BASE_URL}/api/v1`;
export const SOCKET_URL = BASE_URL;
// Origin used to resolve relative image paths (e.g. "/uploads/x.png") returned by
// the media API, so uploaded images load over whatever host the app is using.
export const MEDIA_BASE_URL = BASE_URL;
