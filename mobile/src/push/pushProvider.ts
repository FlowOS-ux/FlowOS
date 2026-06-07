/**
 * FlowOS mobile - src/push/pushProvider.ts
 * Source of the device push token.
 *
 * FCM (@react-native-firebase/messaging) is NOT installed yet, so this returns
 * null and device registration is a safe no-op. When FCM is wired, this is the
 * ONLY place that changes — request permission and return messaging().getToken();
 * the registration lifecycle in deviceToken.ts already handles the rest.
 */
export async function getPushToken(): Promise<string | null> {
  // TODO(FCM): once @react-native-firebase/messaging is installed:
  //   import messaging from '@react-native-firebase/messaging';
  //   const status = await messaging().requestPermission();
  //   if (!enabled(status)) return null;
  //   return messaging().getToken();
  return null;
}
