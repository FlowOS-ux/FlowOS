/**
 * FlowOS - mobile app root.
 * Providers: SafeArea → Paper (themed) → Auth → Navigation.
 *
 * @format
 */
import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { AuthProvider } from './src/auth/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import ConnectivityBanner from './src/components/ConnectivityBanner';
import TurnAlerts from './src/realtime/TurnAlerts';
import { theme } from './src/theme';

function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
          <AuthProvider>
            <RootNavigator />
            {/* Global "it's your turn" alerts (modal on call, banner on reconnect). */}
            <TurnAlerts />
          </AuthProvider>
          {/* Global, app-wide connectivity indicator (overlays everything). */}
          <ConnectivityBanner />
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
