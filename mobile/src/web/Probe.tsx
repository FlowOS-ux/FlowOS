/**
 * FlowOS mobile - src/web/Probe.tsx
 * TEMP diagnostic: isolates which layer renders on web.
 *  - yellow DOM box  => react-dom is mounting
 *  - green RNW box   => react-native-web + providers render
 * If only yellow shows, the issue is rn-web/providers. If both show, the issue is navigation.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider, Text as PaperText } from 'react-native-paper';
import { theme } from '../theme';

export function Probe() {
  return (
    <>
      <div style={{ padding: 12, background: '#fde68a', color: '#000', fontFamily: 'sans-serif' }}>
        ✅ DOM OK — react-dom is mounting
      </div>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <PaperProvider theme={theme}>
            <View style={{ flex: 1, padding: 16, backgroundColor: '#86efac' }}>
              <Text style={{ fontSize: 18, color: '#000' }}>✅ RNW View+Text render</Text>
              <PaperText variant="titleMedium" style={{ marginTop: 8 }}>
                ✅ Paper renders
              </PaperText>
            </View>
          </PaperProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </>
  );
}
