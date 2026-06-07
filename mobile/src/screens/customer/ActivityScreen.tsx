/**
 * FlowOS mobile - src/screens/customer/ActivityScreen.tsx
 * Live tracking of the user's active queue entries. Polls position/ETA every 5s
 * while focused. (Socket.IO can replace polling later behind the same UI.)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, RefreshControl } from 'react-native';
import { Text, Card, Button, ActivityIndicator, Chip } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { entryApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { useQueueEvents } from '../../realtime/useQueueEvents';
import { isConnected, onConnectionChange } from '../../realtime/socket';
import { theme, spacing, statusColors } from '../../theme';
import type { Entry } from '../../api/types';

// Real-time drives updates; polling is only a slow safety net.
const POLL_MS = 20000;

function fmtEta(sec?: number): string {
  if (!sec || sec <= 0) return 'Now';
  const m = Math.round(sec / 60);
  return m <= 1 ? '~1 min' : `~${m} min`;
}

export default function ActivityScreen() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(isConnected());
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      setEntries(await entryApi.mine());
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Subscribe to the rooms for every queue the user is currently in.
  const queueIds = useMemo(() => entries.map((e) => e.queueId), [entries]);
  useQueueEvents(queueIds, load);

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

  const leave = async (id: string) => {
    try {
      await entryApi.leave(id);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
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
      contentContainerStyle={styles.content}
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
      {entries.length === 0 && (
        <Text style={styles.empty}>{error ?? "You're not in any queues right now."}</Text>
      )}
      {entries.map((e) => {
        const isCalled = e.status === 'CALLED';
        return (
          <Card key={e.id} style={[styles.card, isCalled && styles.calledCard]}>
            <Card.Title
              title={e.queueName ?? 'Queue'}
              subtitle={`Ticket #${e.ticketNumber}`}
            />
            <Card.Content style={styles.body}>
              {isCalled ? (
                <Text variant="headlineSmall" style={styles.called}>
                  It&apos;s your turn! 🎉
                </Text>
              ) : (
                <View style={styles.row}>
                  <View style={styles.metric}>
                    <Text variant="displaySmall" style={styles.metricValue}>
                      {e.position ?? '-'}
                    </Text>
                    <Text variant="bodySmall">Position</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text variant="headlineSmall" style={styles.metricValue}>
                      {fmtEta(e.estimatedWaitSec)}
                    </Text>
                    <Text variant="bodySmall">Est. wait</Text>
                  </View>
                </View>
              )}
              <Text style={[styles.status, { color: statusColors[e.status] }]}>{e.status}</Text>
            </Card.Content>
            <Card.Actions>
              <Button onPress={() => leave(e.id)} textColor={theme.colors.error}>
                Leave
              </Button>
            </Card.Actions>
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: spacing.md, gap: spacing.md, flexGrow: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: theme.colors.surface },
  calledCard: { borderWidth: 2, borderColor: theme.colors.primary },
  body: { gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  metric: { alignItems: 'center' },
  metricValue: { fontWeight: '800', color: theme.colors.primary },
  called: { color: theme.colors.primary, fontWeight: '800', textAlign: 'center' },
  status: { textAlign: 'center', fontWeight: '700', letterSpacing: 1 },
  empty: { textAlign: 'center', marginTop: spacing.xl, color: theme.colors.onSurfaceVariant },
  statusRow: { alignItems: 'flex-end' },
  liveChip: { alignSelf: 'flex-end' },
});
