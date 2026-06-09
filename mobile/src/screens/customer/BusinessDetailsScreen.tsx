/**
 * FlowOS mobile - src/screens/customer/BusinessDetailsScreen.tsx
 * Business profile + its queues. Tap a queue to join.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, Card, Button, Chip, ActivityIndicator, Snackbar } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Screen from '../../components/Screen';
import { businessApi, queueApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { businessImageUrl } from '../../lib/images';
import { theme, spacing, statusColors } from '../../theme';
import type { Business, Queue } from '../../api/types';
import type { CustomerStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<CustomerStackParamList, 'BusinessDetails'>;

export default function BusinessDetailsScreen({ route, navigation }: Props) {
  const { businessId } = route.params;
  const [business, setBusiness] = useState<Business | null>(null);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, q] = await Promise.all([
        businessApi.get(businessId),
        businessApi.queues(businessId),
      ]);
      setBusiness(b);
      setQueues(q);
      navigation.setOptions({ title: b.name });
    } catch (err) {
      setSnack(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [businessId, navigation]);

  useEffect(() => {
    load();
  }, [load]);

  const join = async (queueId: string) => {
    setJoiningId(queueId);
    try {
      const entry = await queueApi.join(queueId);
      setSnack(`Joined! You are position #${entry.position}.`);
    } catch (err) {
      setSnack(apiErrorMessage(err));
    } finally {
      setJoiningId(null);
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
    <Screen scroll refreshing={false} onRefresh={load}>
      {business && (
        <Card style={styles.card}>
          <Card.Cover source={{ uri: businessImageUrl(business) }} style={styles.cover} />
          <Card.Title
            title={business.name}
            subtitle={`${business.category} · ★ ${business.ratingAvg.toFixed(1)} (${business.ratingCount})`}
          />
          {business.description ? (
            <Card.Content>
              <Text variant="bodyMedium">{business.description}</Text>
            </Card.Content>
          ) : null}
        </Card>
      )}

      <Text variant="titleMedium" style={styles.heading}>
        Queues
      </Text>
      {queues.length === 0 && <Text style={styles.muted}>No queues available right now.</Text>}
      {queues.map((q) => (
        <Card key={q.id} style={styles.card}>
          <Card.Title
            title={q.name}
            subtitle={`~${Math.round(q.avgServiceSec / 60)} min per person`}
            right={() => (
              <Chip compact style={[styles.chip, { backgroundColor: statusColors[q.status] }]}>
                <Text style={styles.chipText}>{q.status}</Text>
              </Chip>
            )}
          />
          <Card.Actions>
            <Button
              mode="contained"
              disabled={q.status !== 'OPEN' || joiningId === q.id}
              loading={joiningId === q.id}
              onPress={() => join(q.id)}
            >
              Join queue
            </Button>
          </Card.Actions>
        </Card>
      ))}

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={3000}>
        {snack ?? ''}
      </Snackbar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: theme.colors.surface, overflow: 'hidden' },
  cover: { height: 160 },
  heading: { marginTop: spacing.sm, fontWeight: '700' },
  muted: { color: theme.colors.onSurfaceVariant },
  chip: { marginRight: spacing.md, alignSelf: 'center' },
  chipText: { color: '#fff', fontSize: 11 },
});
