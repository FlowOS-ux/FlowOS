/**
 * FlowOS mobile - src/push/deviceToken.ts
 * Device-token registration lifecycle. Called on login/session-restore and logout.
 * Registers this device's push token with the backend so FCM can target it.
 *
 * Until FCM is wired (see pushProvider.ts), getPushToken() returns null and these
 * become safe no-ops — the plumbing is complete and ready for the FCM token.
 */
import { Platform } from 'react-native';
import { notificationApi } from '../api/endpoints';
import { getPushToken } from './pushProvider';

// Backend expects uppercase platform; RN's Platform.OS is lowercase.
function devicePlatform(): 'IOS' | 'ANDROID' | 'WEB' {
  if (Platform.OS === 'ios') return 'IOS';
  if (Platform.OS === 'android') return 'ANDROID';
  return 'WEB';
}

// Remember what we registered so we can clean it up on logout.
let registeredToken: string | null = null;

/**
 * Register this device for push, gated by the user's pushEnabled setting.
 * Returns the registered token, or null if disabled / no token / FCM not wired.
 */
export async function registerDeviceToken(opts?: { pushEnabled?: boolean }): Promise<string | null> {
  if (opts?.pushEnabled === false) return null;

  const token = await getPushToken();
  if (!token) return null;

  await notificationApi.registerDevice(token, devicePlatform());
  registeredToken = token;
  return token;
}

/** Remove this device's token from the backend (best-effort) on logout. */
export async function unregisterDeviceToken(): Promise<void> {
  if (!registeredToken) return;
  const token = registeredToken;
  registeredToken = null;
  await notificationApi.removeDevice(token);
}
