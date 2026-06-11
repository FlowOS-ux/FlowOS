/**
 * FlowOS mobile - src/components/ConnectivityBanner.tsx
 * Thin global banner reflecting the app-wide connectivity state. Mounted once at
 * the app root. It is purely informational — the API client retries and recovers
 * on its own; this just tells the user what's happening instead of a dead screen.
 *
 *   reconnecting -> "Reconnecting…" (a request is failing and retrying)
 *   offline      -> "No connection. Retrying automatically…"
 *   online       -> briefly shows "Back online" after a recovery, then hides
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { subscribeNetState, getNetState, type NetState } from '../net/connectivity';

const COPY: Record<Exclude<NetState, 'online'>, { text: string; bg: string }> = {
  reconnecting: { text: 'Reconnecting…', bg: '#B45309' },
  offline: { text: 'No connection. Retrying automatically…', bg: '#B91C1C' },
};

export default function ConnectivityBanner() {
  const [state, setState] = useState<NetState>(getNetState());
  const [showBackOnline, setShowBackOnline] = useState(false);
  const prev = useRef<NetState>(state);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => subscribeNetState(setState), []);

  // Show a short-lived "Back online" confirmation when we recover from a down state.
  useEffect(() => {
    const wasDown = prev.current !== 'online';
    if (state === 'online' && wasDown) {
      setShowBackOnline(true);
      const t = setTimeout(() => setShowBackOnline(false), 2500);
      prev.current = state;
      return () => clearTimeout(t);
    }
    prev.current = state;
  }, [state]);

  const visible = state !== 'online' || showBackOnline;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  if (!visible) return null;

  const banner =
    state === 'online'
      ? { text: 'Back online', bg: '#15803D' }
      : COPY[state];

  return (
    <Animated.View style={[styles.wrap, { opacity }]} pointerEvents="none">
      <View style={[styles.banner, { backgroundColor: banner.bg }]}>
        <Text style={styles.text}>{banner.text}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, top: 0, zIndex: 1000, alignItems: 'center' },
  banner: { width: '100%', paddingVertical: 6, paddingHorizontal: 12, alignItems: 'center' },
  text: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
});
