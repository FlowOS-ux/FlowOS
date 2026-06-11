/**
 * FlowOS mobile - src/realtime/TurnAlerts.tsx
 * App-wide "It's your turn" alert layer. Mounted once at the app root so it fires
 * on ANY screen. Driven entirely by existing free infrastructure (Socket.IO):
 *
 *   • Live call → CENTER MODAL + sound. Listens to the personal `queue_next` event
 *     (the backend emits it to the called user's room on call-next) and gates on
 *     `calledUserId === me` so other waiters in the same queue room don't see it.
 *   • Reconnect recovery → TOP BANNER + sound. Socket.IO rooms don't buffer events
 *     fired while offline, so on (re)connect we fetch the user's active entries and,
 *     if any is CALLED and not yet acknowledged, surface a banner. This makes the
 *     "called while disconnected" case recover without a manual refresh.
 *
 * Dedupe is by entry id, shared across both paths, so the same call never alerts
 * twice. When Firebase/FCM is added later, background delivery flows through the
 * SAME backend notify() pipeline — this foreground layer is unchanged.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Portal, Dialog, Button, Text } from 'react-native-paper';
import { useAuth } from '../auth/AuthContext';
import { getSocket, onConnectionChange } from './socket';
import { entryApi } from '../api/endpoints';
import { playTurnAlert } from '../lib/sound';
import { goToMyQueues } from '../navigation/navigationRef';
import { theme, spacing, radius } from '../theme';

// Canonical personal "you're being called" event (matches backend QUEUE_EVENTS.NEXT).
const QUEUE_NEXT = 'queue_next';
const BANNER_MS = 6000;

interface QueueNextPayload {
  queueId?: string;
  entryId?: string;
  ticketNumber?: number;
  calledUserId?: string;
}

interface TurnInfo {
  entryId: string;
  ticketNumber?: number;
  queueName?: string;
}

export default function TurnAlerts() {
  const { user } = useAuth();
  const [modal, setModal] = useState<TurnInfo | null>(null);
  const [banner, setBanner] = useState<TurnInfo | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBanner = useCallback((info: TurnInfo) => {
    setBanner(info);
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), BANNER_MS);
  }, []);

  useEffect(() => {
    if (!user) {
      seen.current.clear();
      return;
    }
    const userId = user.id;

    // Live call → modal.
    const onNext = (payload: QueueNextPayload) => {
      if (!payload || payload.calledUserId !== userId) return; // only the called user
      const key = payload.entryId ?? payload.queueId ?? '';
      if (!key || seen.current.has(key)) return; // dedupe
      seen.current.add(key);
      setModal({ entryId: key, ticketNumber: payload.ticketNumber });
      playTurnAlert();
    };

    // Bind the listener to the current socket (rebinds if the singleton changes).
    let bound: ReturnType<typeof getSocket> = null;
    const bind = () => {
      const socket = getSocket();
      if (socket && socket !== bound) {
        bound?.off(QUEUE_NEXT, onNext);
        socket.on(QUEUE_NEXT, onNext);
        bound = socket;
      }
    };

    // Reconnect (and first-connect) recovery → banner for any unseen CALLED entry.
    const recover = async () => {
      try {
        const mine = await entryApi.mine();
        const called = mine.find((e) => e.status === 'CALLED' && !seen.current.has(e.id));
        if (called) {
          seen.current.add(called.id);
          showBanner({
            entryId: called.id,
            ticketNumber: called.ticketNumber,
            queueName: called.queueName,
          });
          playTurnAlert();
        }
      } catch {
        // Offline / transient — the connectivity layer will retry.
      }
    };

    bind();
    const unsub = onConnectionChange((connected) => {
      bind();
      if (connected) void recover();
    });

    return () => {
      bound?.off(QUEUE_NEXT, onNext);
      unsub();
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
  }, [user, showBanner]);

  const openQueue = useCallback(() => {
    setModal(null);
    setBanner(null);
    goToMyQueues();
  }, []);

  return (
    <Portal>
      {/* Reconnect-recovery banner (non-blocking, auto-dismisses, tappable). */}
      {banner && (
        <Pressable style={styles.bannerWrap} onPress={openQueue} accessibilityRole="button">
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              🔔 It&apos;s your turn{banner.ticketNumber ? ` — Ticket #${banner.ticketNumber}` : ''}
              {banner.queueName ? ` (${banner.queueName})` : ''}. Tap to view ›
            </Text>
          </View>
        </Pressable>
      )}

      {/* Live-call modal (blocking, demands attention). */}
      <Dialog visible={!!modal} onDismiss={() => setModal(null)}>
        <Dialog.Icon icon="bell-ring" />
        <Dialog.Title style={styles.title}>It&apos;s your turn now</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium" style={styles.body}>
            Please proceed to the service counter.
            {modal?.ticketNumber ? `\nTicket #${modal.ticketNumber}` : ''}
          </Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setModal(null)}>Dismiss</Button>
          <Button mode="contained" onPress={openQueue}>
            View my queue
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  title: { textAlign: 'center' },
  body: { textAlign: 'center' },
  bannerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2000,
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  banner: {
    width: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  bannerText: { color: '#FFFFFF', fontWeight: '700', textAlign: 'center' },
});
