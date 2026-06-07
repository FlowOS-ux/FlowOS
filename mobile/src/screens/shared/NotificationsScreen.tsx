/**
 * FlowOS mobile - src/screens/shared/NotificationsScreen.tsx
 * In-app notification feed. Real-time via `notification:new`; a slow poll is a
 * safety net. Tap to mark read.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, RefreshControl } from 'react-native';
import { Text, List, Button, ActivityIndicator, Chip } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { notificationApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { useNotificationEvents } from '../../realtime/useRealtimeEvents';
import { isConnected, onConnectionChange } from '../../realtime/socket';
import { theme, spacing } from '../../theme';
import type { AppNotification } from '../../api/types';

// Real-time drives updates; polling is only a slow safety net.
const POLL_MS = 30000;

export default function NotificationsScreen() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(isConnected());
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await notificationApi.list();
      setItems(res.items);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch the feed whenever a new notification is pushed.
  useNotificationEvents(load);

  // Track socket connection for the live/reconnecting badge.
  useEffect(() => {
    setLive(isConnected());
    return onConnectionChange(setLive);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      timer.current = setInterval(load, POLL_MS);
      return () => {
        if (timer.current) clearInterval(timer.current);
      };
    }, [load]),
  );

  const markRead = async (id: string) => {
    try {
      await notificationApi.markRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch {
      // ignore
    }
  };

  const markAll = async () => {
    await notificationApi.markAllRead().catch(() => undefined);
    load();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
    >
      <View style={styles.statusRow}>
        <Chip
          compact
          icon={live ? 'access-point' : 'access-point-off'}
          style={[styles.liveChip, { backgroundColor: live ? '#DCFCE7' : '#FEE2E2' }]}
        >
          {live ? 'Live' : 'Reconnecting…'}
        </Chip>
      </View>
      {items.length > 0 && (
        <Button style={styles.markAll} onPress={markAll}>
          Mark all read
        </Button>
      )}
      {items.length === 0 && (
        <Text style={styles.empty}>{error ?? 'No notifications yet.'}</Text>
      )}
      {items.map((n) => (
        <List.Item
          key={n.id}
          title={n.title}
          description={n.body}
          onPress={() => markRead(n.id)}
          left={(props) => (
            <List.Icon
              {...props}
              icon={n.read ? 'bell-outline' : 'bell-badge'}
              color={n.read ? theme.colors.onSurfaceVariant : theme.colors.primary}
            />
          )}
          style={[styles.item, !n.read && styles.unread]}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  item: { backgroundColor: theme.colors.surface },
  unread: { backgroundColor: theme.colors.primaryContainer },
  markAll: { alignSelf: 'flex-end', marginRight: spacing.sm },
  empty: { textAlign: 'center', marginTop: spacing.xl, color: theme.colors.onSurfaceVariant },
  statusRow: { alignItems: 'flex-end', paddingRight: spacing.sm, paddingTop: spacing.sm },
  liveChip: { alignSelf: 'flex-end' },
});
