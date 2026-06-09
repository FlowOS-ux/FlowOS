/**
 * FlowOS mobile - src/screens/admin/AdminDashboardScreen.tsx
 * Platform-admin verification queue: businesses that owners submitted for review.
 * Tap a business to open the review screen (approve / reject).
 */
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, Card, Chip, ActivityIndicator, Button } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Screen from '../../components/Screen';
import { adminApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { theme, spacing, statusColors, businessStatusLabels } from '../../theme';
import type { Business } from '../../api/types';
import type { AdminStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<AdminStackParamList>;

export default function AdminDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const [pending, setPending] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const businesses = await adminApi.pendingBusinesses();
      setPending(businesses);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = () => {
    setRefreshing(true);
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
    <Screen scroll refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.header}>
        <Text variant="titleLarge">Verification queue</Text>
        <Chip compact>{pending.length} pending</Chip>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {!error && pending.length === 0 && (
        <Text style={styles.empty}>No businesses awaiting review 🎉</Text>
      )}

      {pending.map((business) => (
        <Card key={business.id} style={styles.card}>
          <Card.Title
            title={business.name}
            subtitle={business.category}
            right={() => (
              <Chip
                compact
                textStyle={styles.statusChipText}
                style={[styles.statusChip, { backgroundColor: statusColors[business.status] }]}
              >
                {businessStatusLabels[business.status] ?? business.status}
              </Chip>
            )}
          />
          {business.description ? (
            <Card.Content>
              <Text variant="bodySmall" numberOfLines={2} style={styles.muted}>
                {business.description}
              </Text>
            </Card.Content>
          ) : null}
          <Card.Actions>
            <Button
              mode="contained-tonal"
              icon="clipboard-text-search-outline"
              onPress={() => navigation.navigate('BusinessReview', { business })}
            >
              Review
            </Button>
          </Card.Actions>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: { backgroundColor: theme.colors.surface },
  statusChip: { marginRight: spacing.xs },
  statusChipText: { color: '#FFFFFF', fontWeight: '700', fontSize: 11 },
  muted: { color: theme.colors.onSurfaceVariant },
  empty: { textAlign: 'center', marginTop: spacing.xl, color: theme.colors.onSurfaceVariant },
  error: { color: theme.colors.error },
});
