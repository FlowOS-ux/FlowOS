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
import { onRecovered } from '../../net/connectivity';
import ErrorState from '../../components/ErrorState';
import { businessImageUrl } from '../../lib/images';
import { theme, spacing } from '../../theme';
import type { Business } from '../../api/types';
import type { CustomerStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<CustomerStackParamList>;

type Coords = { lat: number; lng: number };

// Minimal geolocation shape (browser API on web; avoids depending on DOM lib types).
type Geo = {
  getCurrentPosition: (
    success: (pos: { coords: { latitude: number; longitude: number } }) => void,
    error?: (err: unknown) => void,
    opts?: { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number },
  ) => void;
};

const NEAR_RADIUS_KM = 50;

export default function ExploreScreen() {
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nearMe, setNearMe] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);

  const load = useCallback(async (search: string, near: Coords | null) => {
    setLoading(true);
    setError(null);
    try {
      const res = await businessApi.explore({
        search: search || undefined,
        ...(near ? { lat: near.lat, lng: near.lng, radiusKm: NEAR_RADIUS_KM } : {}),
      });
      setItems(res.items);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(query, nearMe ? coords : null), 350);
    return () => clearTimeout(t);
  }, [query, nearMe, coords, load]);

  // Background recovery: when connectivity returns after an outage, refetch the
  // list automatically — no manual pull-to-refresh / app refresh needed.
  useEffect(
    () => onRecovered(() => load(query, nearMe ? coords : null)),
    [query, nearMe, coords, load],
  );

  const toggleNearMe = useCallback(() => {
    if (nearMe) {
      setNearMe(false);
      setCoords(null);
      return;
    }
    const geo = (globalThis as { navigator?: { geolocation?: Geo } }).navigator?.geolocation;
    if (!geo) {
      setError('Location is not available on this device.');
      return;
    }
    setLocating(true);
    geo.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setNearMe(true);
        setLocating(false);
      },
      () => {
        setError('Could not get your location. Allow location access and try again.');
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }, [nearMe]);

  return (
    <View style={styles.root}>
      <Searchbar
        placeholder="Search businesses"
        value={query}
        onChangeText={setQuery}
        style={styles.search}
      />
      <View style={styles.filters}>
        <Chip
          icon="map-marker"
          selected={nearMe}
          showSelectedOverlay
          disabled={locating}
          onPress={toggleNearMe}
        >
          {locating ? 'Locating…' : nearMe ? `Near me (${NEAR_RADIUS_KM} km)` : 'Near me'}
        </Chip>
      </View>
      {loading ? (
        <ActivityIndicator style={styles.loader} color={theme.colors.primary} />
      ) : error && items.length === 0 ? (
        <ErrorState message={error} onRetry={() => load(query, nearMe ? coords : null)} />
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
              <Card.Cover source={{ uri: businessImageUrl(item) }} style={styles.cover} />
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
  search: { marginHorizontal: spacing.md, marginTop: spacing.md },
  filters: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.sm },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg, gap: spacing.sm },
  card: { backgroundColor: theme.colors.surface, overflow: 'hidden' },
  cover: { height: 140 },
  chip: { marginRight: spacing.md, alignSelf: 'center' },
  loader: { marginTop: spacing.xl },
  empty: { textAlign: 'center', marginTop: spacing.xl, color: theme.colors.onSurfaceVariant },
});
