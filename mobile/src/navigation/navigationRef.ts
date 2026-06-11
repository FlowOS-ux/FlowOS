/**
 * FlowOS mobile - src/navigation/navigationRef.ts
 * App-wide navigation ref so non-screen code (e.g. the global "your turn" alert)
 * can navigate without a navigation prop. Attached to NavigationContainer in
 * RootNavigator.
 */
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

/** Jump to the customer's "My Queues" (Activity) tab, if available. */
export function goToMyQueues(): void {
  if (!navigationRef.isReady()) return;
  try {
    // Nested navigation: focus the Activity tab inside the customer tab navigator.
    // The ref is untyped (shared across role-specific navigators), so cast navigate.
    const navigate = navigationRef.navigate as unknown as (name: string, params?: object) => void;
    navigate('CustomerTabs', { screen: 'Activity' });
  } catch {
    // No-op if the current navigator has no such route (e.g. non-customer role).
  }
}
