/**
 * FlowOS mobile - src/screens/business/BusinessesScreen.tsx
 * Owner/staff dashboard: businesses you manage, a today summary, and their queues.
 * Tap a queue to open the live Queue Manager.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, RefreshControl } from 'react-native';
import {
  Text,
  Card,
  Button,
  IconButton,
  ActivityIndicator,
  Divider,
  FAB,
  Chip,
} from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { businessApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { useDashboardEvents } from '../../realtime/useRealtimeEvents';
import { isConnected, onConnectionChange } from '../../realtime/socket';
import { theme, spacing, statusColors, businessStatusLabels } from '../../theme';
import type { Business, Queue, AnalyticsSummary } from '../../api/types';
import type { BusinessStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<BusinessStackParamList>;

interface BusinessView {
  business: Business;
  queues: Queue[];
  summary: AnalyticsSummary | null;
}

export default function BusinessesScreen() {
  const navigation = useNavigation<Nav>();
  const [views, setViews] = useState<BusinessView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(isConnected());

  const load = useCallback(async () => {
    try {
      const businesses = await businessApi.mine();
      const built = await Promise.all(
        businesses.map(async (business) => {
          const [queues, summary] = await Promise.all([
            businessApi.queues(business.id).catch(() => [] as Queue[]),
            businessApi.analyticsSummary(business.id).catch(() => null),
          ]);
          return { business, queues, summary };
        }),
      );
      setViews(built);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Live dashboard: refetch when any owned business emits `dashboard:updated`.
  const businessIds = useMemo(() => views.map((v) => v.business.id), [views]);
  useDashboardEvents(businessIds, load);

  // Track socket connection for the live/reconnecting badge.
  useEffect(() => {
    setLive(isConnected());
    return onConnectionChange(setLive);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
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
        {views.length === 0 && (
          <Text style={styles.empty}>
            {error ?? 'You have no businesses yet. Tap + to create one.'}
          </Text>
        )}

      {views.map(({ business, queues, summary }) => (
        <Card key={business.id} style={styles.card}>
          <Card.Title
            title={business.name}
            subtitle={business.category}
            right={() => (
              <View style={styles.titleRight}>
                <Chip
                  compact
                  textStyle={styles.statusChipText}
                  style={[styles.statusChip, { backgroundColor: statusColors[business.status] }]}
                >
                  {businessStatusLabels[business.status] ?? business.status}
                </Chip>
                <IconButton
                  icon="cog-outline"
                  size={20}
                  onPress={() => navigation.navigate('BusinessSetup', { business })}
                />
              </View>
            )}
          />
          {business.status === 'APPROVED' ? (
            <>
              {summary && (
                <Card.Content>
                  <View style={styles.metrics}>
                    <Metric label="Waiting" value={summary.currentlyWaiting} />
                    <Metric label="Served (24h)" value={summary.completed} />
                    <Metric label="No-shows" value={summary.noShows} />
                  </View>
                </Card.Content>
              )}
              <Divider style={styles.divider} />
              <Card.Content style={styles.queues}>
                {queues.length === 0 && <Text style={styles.muted}>No queues yet.</Text>}
                {queues.map((q) => (
                  <View key={q.id} style={styles.queueRow}>
                    <View style={styles.flex}>
                      <Text variant="titleSmall">{q.name}</Text>
                      <Text variant="bodySmall" style={styles.muted}>
                        {q.status}
                      </Text>
                    </View>
                    <IconButton
                      icon="pencil"
                      size={20}
                      onPress={() =>
                        navigation.navigate('QueueForm', { businessId: business.id, queue: q })
                      }
                    />
                    <Button
                      mode="contained-tonal"
                      compact
                      onPress={() =>
                        navigation.navigate('QueueManager', { queueId: q.id, queueName: q.name })
                      }
                    >
                      Manage
                    </Button>
                  </View>
                ))}
                <Button
                  mode="text"
                  icon="plus"
                  onPress={() => navigation.navigate('QueueForm', { businessId: business.id })}
                >
                  Add queue
                </Button>
              </Card.Content>
            </>
          ) : (
            <Card.Content>
              {business.status === 'PENDING_VERIFICATION' ? (
                <View style={styles.banner}>
                  <Text variant="titleSmall">⏳ Awaiting admin approval</Text>
                  <Text variant="bodySmall" style={[styles.muted, styles.activateNote]}>
                    Your business is under review. An administrator must approve your business
                    before you can start managing queues.
                  </Text>
                </View>
              ) : (
                <View style={styles.banner}>
                  <Text variant="titleSmall" style={styles.rejectedTitle}>
                    Not approved
                  </Text>
                  <Text variant="bodySmall" style={[styles.muted, styles.activateNote]}>
                    {business.rejectionReason
                      ? `Reason: ${business.rejectionReason}`
                      : 'This business was not approved by the review team.'}
                  </Text>
                  <Button
                    mode="text"
                    icon="cog-outline"
                    onPress={() => navigation.navigate('BusinessSetup', { business })}
                  >
                    Edit details
                  </Button>
                </View>
              )}
            </Card.Content>
          )}
        </Card>
      ))}
      </ScrollView>
      <FAB
        icon="plus"
        label="Business"
        style={styles.fab}
        onPress={() => navigation.navigate('CreateBusiness')}
      />
    </View>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metric}>
      <Text variant="headlineSmall" style={styles.metricValue}>
        {value}
      </Text>
      <Text variant="bodySmall" style={styles.muted}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  fab: { position: 'absolute', right: spacing.md, bottom: spacing.lg },
  content: { padding: spacing.md, gap: spacing.md, flexGrow: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: theme.colors.surface },
  titleRight: { flexDirection: 'row', alignItems: 'center', paddingRight: spacing.xs },
  statusChip: { marginRight: spacing.xs },
  statusChipText: { color: '#FFFFFF', fontWeight: '700', fontSize: 11 },
  activateNote: { marginTop: spacing.xs },
  banner: { gap: spacing.xs },
  rejectedTitle: { color: theme.colors.error },
  metrics: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing.sm },
  metric: { alignItems: 'center' },
  metricValue: { fontWeight: '800', color: theme.colors.primary },
  divider: { marginVertical: spacing.xs },
  queues: { gap: spacing.sm },
  queueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  muted: { color: theme.colors.onSurfaceVariant },
  empty: { textAlign: 'center', marginTop: spacing.xl, color: theme.colors.onSurfaceVariant },
  statusRow: { alignItems: 'flex-end' },
  liveChip: { alignSelf: 'flex-end' },
});
