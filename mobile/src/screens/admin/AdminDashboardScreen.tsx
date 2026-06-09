/**
 * FlowOS mobile - src/screens/admin/AdminDashboardScreen.tsx
 * Platform-admin verification dashboard. A segmented filter switches between the
 * Pending / Approved / Rejected business queues. Tap a business to review it.
 */
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Text,
  Card,
  Chip,
  Button,
  ActivityIndicator,
  SegmentedButtons,
} from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Screen from '../../components/Screen';
import { adminApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { theme, spacing, statusColors, businessStatusLabels } from '../../theme';
import type { AdminBusiness } from '../../api/types';
import type { AdminStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<AdminStackParamList>;
type Filter = 'pending' | 'approved' | 'rejected';

const LOADERS: Record<Filter, () => Promise<AdminBusiness[]>> = {
  pending: adminApi.pendingBusinesses,
  approved: adminApi.approvedBusinesses,
  rejected: adminApi.rejectedBusinesses,
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return '';
  }
}

export default function AdminDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const [filter, setFilter] = useState<Filter>('pending');
  const [businesses, setBusinesses] = useState<AdminBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (f: Filter) => {
    try {
      const list = await LOADERS[f]();
      setBusinesses(list);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reloads on focus and whenever the filter changes.
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load(filter);
    }, [load, filter]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    load(filter);
  };

  return (
    <Screen scroll refreshing={refreshing} onRefresh={onRefresh}>
      <Text variant="titleLarge">Business verification</Text>
      <SegmentedButtons
        value={filter}
        onValueChange={(v) => setFilter(v as Filter)}
        buttons={[
          { value: 'pending', label: 'Pending' },
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Rejected' },
        ]}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : businesses.length === 0 ? (
        <Text style={styles.empty}>
          {filter === 'pending'
            ? 'No businesses awaiting review 🎉'
            : `No ${filter} businesses.`}
        </Text>
      ) : (
        businesses.map((b) => (
          <Card key={b.id} style={styles.card}>
            <Card.Title
              title={b.name}
              subtitle={b.category}
              right={() => (
                <Chip
                  compact
                  textStyle={styles.statusChipText}
                  style={[styles.statusChip, { backgroundColor: statusColors[b.status] }]}
                >
                  {businessStatusLabels[b.status] ?? b.status}
                </Chip>
              )}
            />
            <Card.Content>
              <Text variant="bodyMedium">{b.owner.name ?? 'Unknown owner'}</Text>
              <Text variant="bodySmall" style={styles.muted}>
                {b.owner.email ?? '—'}
                {b.phone ? ` · ${b.phone}` : ''}
              </Text>
              <Text variant="bodySmall" style={styles.muted}>
                Submitted {formatDate(b.submittedAt)}
              </Text>
            </Card.Content>
            <Card.Actions>
              <Button
                mode={b.status === 'PENDING_VERIFICATION' ? 'contained-tonal' : 'text'}
                icon="clipboard-text-search-outline"
                onPress={() => navigation.navigate('BusinessReview', { business: b })}
              >
                {b.status === 'PENDING_VERIFICATION' ? 'Review' : 'View'}
              </Button>
            </Card.Actions>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: spacing.xl, alignItems: 'center' },
  card: { backgroundColor: theme.colors.surface },
  statusChip: { marginRight: spacing.xs },
  statusChipText: { color: '#FFFFFF', fontWeight: '700', fontSize: 11 },
  muted: { color: theme.colors.onSurfaceVariant },
  empty: { textAlign: 'center', marginTop: spacing.xl, color: theme.colors.onSurfaceVariant },
  error: { color: theme.colors.error, marginTop: spacing.md },
});
