/**
 * FlowOS mobile - src/screens/business/QueueManagerScreen.tsx
 * Live operator view: waiting list + call-next / serve / complete / no-show.
 * Polls the queue every 4s while focused.
 */
import React, { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, RefreshControl } from 'react-native';
import { Text, Card, Button, ActivityIndicator, Snackbar, Chip } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { queueApi, entryApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { useQueueEvents } from '../../realtime/useQueueEvents';
import { theme, spacing, statusColors } from '../../theme';
import type { OperatorEntry } from '../../api/types';
import type { BusinessStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<BusinessStackParamList, 'QueueManager'>;
// Real-time drives updates; polling is only a slow safety net.
const POLL_MS = 20000;

export default function QueueManagerScreen({ route }: Props) {
  const { queueId } = route.params;
  const [entries, setEntries] = useState<OperatorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      setEntries(await queueApi.operatorList(queueId));
    } catch (err) {
      setSnack(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [queueId]);

  // Live updates: refetch whenever the queue changes (join / leave / call / serve / complete).
  useQueueEvents([queueId], load);

  useFocusEffect(
    useCallback(() => {
      load();
      timer.current = setInterval(load, POLL_MS);
      return () => {
        if (timer.current) clearInterval(timer.current);
      };
    }, [load]),
  );

  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    try {
      await fn();
      setSnack(okMsg);
      await load();
    } catch (err) {
      setSnack(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const waiting = entries.filter((e) => e.status === 'WAITING');
  const active = entries.filter((e) => e.status === 'CALLED' || e.status === 'SERVING');

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
      <Button
        mode="contained"
        icon="bullhorn"
        disabled={busy || waiting.length === 0}
        onPress={() => run(() => queueApi.callNext(queueId), 'Called next customer')}
      >
        Call next ({waiting.length} waiting)
      </Button>

      {active.length > 0 && (
        <Text variant="titleMedium" style={styles.heading}>
          In progress
        </Text>
      )}
      {active.map((e) => (
        <Card key={e.id} style={styles.card}>
          <Card.Title
            title={`#${e.ticketNumber} · ${e.customer.name}`}
            right={() => (
              <Chip compact style={[styles.chip, { backgroundColor: statusColors[e.status] }]}>
                <Text style={styles.chipText}>{e.status}</Text>
              </Chip>
            )}
          />
          <Card.Actions>
            {e.status === 'CALLED' && (
              <Button
                disabled={busy}
                onPress={() => run(() => entryApi.serve(e.id), 'Serving started')}
              >
                Serve
              </Button>
            )}
            {e.status === 'CALLED' && (
              <Button
                disabled={busy}
                textColor={theme.colors.error}
                onPress={() => run(() => entryApi.noShow(e.id), 'Marked no-show')}
              >
                No-show
              </Button>
            )}
            <Button
              mode="contained-tonal"
              disabled={busy}
              onPress={() => run(() => entryApi.complete(e.id), 'Completed')}
            >
              Complete
            </Button>
          </Card.Actions>
        </Card>
      ))}

      <Text variant="titleMedium" style={styles.heading}>
        Waiting list
      </Text>
      {waiting.length === 0 && <Text style={styles.muted}>No one is waiting.</Text>}
      {waiting.map((e) => (
        <Card key={e.id} style={styles.card}>
          <Card.Title title={`${e.position}. ${e.customer.name}`} subtitle={`Ticket #${e.ticketNumber}`} />
        </Card>
      ))}

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={2500}>
        {snack ?? ''}
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: spacing.md, gap: spacing.md, flexGrow: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: theme.colors.surface },
  heading: { fontWeight: '700', marginTop: spacing.sm },
  muted: { color: theme.colors.onSurfaceVariant },
  chip: { marginRight: spacing.md, alignSelf: 'center' },
  chipText: { color: '#fff', fontSize: 11 },
});
