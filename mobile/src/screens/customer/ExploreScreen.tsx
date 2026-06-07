/**
 * FlowOS mobile - src/screens/customer/ExploreScreen.tsx
 * Browse + search active businesses; tap to view details and join a queue.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Searchbar, Card, Text, Chip, ActivityIndicator } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { businessApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { theme, spacing } from '../../theme';
import type { Business } from '../../api/types';
import type { CustomerStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<CustomerStackParamList>;

export default function ExploreScreen() {
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (search: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await businessApi.explore({ search: search || undefined });
      setItems(res.items);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(query), 350);
    return () => clearTimeout(t);
  }, [query, load]);

  return (
    <View style={styles.root}>
      <Searchbar
        placeholder="Search businesses"
        value={query}
        onChangeText={setQuery}
        style={styles.search}
      />
      {loading ? (
        <ActivityIndicator style={styles.loader} color={theme.colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>{error ?? 'No businesses found.'}</Text>
          }
          renderItem={({ item }) => (
            <Card
              style={styles.card}
              onPress={() => navigation.navigate('BusinessDetails', { businessId: item.id })}
            >
              <Card.Title
                title={item.name}
                subtitle={item.address ?? item.category}
                right={() => (
                  <Chip compact style={styles.chip}>
                    ★ {item.ratingAvg.toFixed(1)}
                  </Chip>
                )}
              />
            </Card>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  search: { margin: spacing.md },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg, gap: spacing.sm },
  card: { backgroundColor: theme.colors.surface },
  chip: { marginRight: spacing.md, alignSelf: 'center' },
  loader: { marginTop: spacing.xl },
  empty: { textAlign: 'center', marginTop: spacing.xl, color: theme.colors.onSurfaceVariant },
});
