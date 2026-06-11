/**
 * FlowOS mobile - src/screens/customer/AIAssistantScreen.tsx
 * AI Assistant: a lightweight chat that helps customers discover the best service
 * to visit. The user asks in natural language ("a bank nearby", "shortest salon
 * queue", "what can I join right now?"); the backend ranks APPROVED businesses by
 * rating, reviews, live queue wait, and availability, and returns both a natural-
 * language reply and structured recommendation cards.
 *
 * Each card supports smart navigation: "Go to Service" opens the business page, and
 * "Join queue" joins the shortest open queue directly from the recommendation.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Text,
  TextInput,
  IconButton,
  Button,
  Card,
  Chip,
  ActivityIndicator,
  Snackbar,
  Avatar,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { aiApi, queueApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { theme, spacing, radius } from '../../theme';
import type { Recommendation } from '../../api/types';
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

type ChatItem =
  | { kind: 'user'; id: number; text: string }
  | { kind: 'assistant'; id: number; text: string; recommendations: Recommendation[] }
  | { kind: 'error'; id: number; text: string };

const SUGGESTIONS = [
  'I need a bank nearby',
  'Which restaurant has the best ratings?',
  'Find a salon with the shortest queue',
  'Suggest a hospital with good reviews',
  'What can I join right now?',
];

const categoryLabel = (c: string): string =>
  c ? c.charAt(0).toUpperCase() + c.slice(1).toLowerCase() : 'Service';

export default function AIAssistantScreen() {
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<ChatItem[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const idRef = useRef(0);
  const nextId = () => (idRef.current += 1);

  // Best-effort location (used for "nearby" requests). Silent if unavailable.
  useEffect(() => {
    const geo = (globalThis as { navigator?: { geolocation?: Geo } }).navigator?.geolocation;
    if (!geo) return;
    geo.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, []);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [items, thinking]);

  const send = useCallback(
    async (raw: string) => {
      const message = raw.trim();
      if (!message || thinking) return;
      setInput('');
      setItems((prev) => [...prev, { kind: 'user', id: nextId(), text: message }]);
      setThinking(true);
      try {
        const res = await aiApi.recommend({
          message,
          ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
        });
        setItems((prev) => [
          ...prev,
          { kind: 'assistant', id: nextId(), text: res.reply, recommendations: res.recommendations },
        ]);
      } catch (err) {
        setItems((prev) => [...prev, { kind: 'error', id: nextId(), text: apiErrorMessage(err) }]);
      } finally {
        setThinking(false);
      }
    },
    [coords, thinking],
  );

  const goToService = useCallback(
    (businessId: string) => navigation.navigate('BusinessDetails', { businessId }),
    [navigation],
  );

  const joinQueue = useCallback(async (rec: Recommendation) => {
    if (!rec.topQueueId) return;
    setJoiningId(rec.businessId);
    try {
      const entry = await queueApi.join(rec.topQueueId);
      setSnack(`Joined ${rec.name} — you're position #${entry.position ?? entry.ticketNumber}.`);
    } catch (err) {
      setSnack(apiErrorMessage(err));
    } finally {
      setJoiningId(null);
    }
  }, []);

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Intro + quick suggestions when the conversation is empty. */}
        {items.length === 0 && (
          <View style={styles.intro}>
            <Avatar.Icon size={64} icon="robot-happy-outline" color="#FFFFFF" style={styles.introIcon} />
            <Text variant="titleLarge" style={styles.introTitle}>
              FlowOS Assistant
            </Text>
            <Text style={styles.introBody}>
              Tell me what you need and I&apos;ll find the best service to visit — ranked by
              ratings, reviews, and live queue wait times.
            </Text>
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <Chip key={s} style={styles.suggestionChip} icon="lightbulb-outline" onPress={() => send(s)}>
                  {s}
                </Chip>
              ))}
            </View>
          </View>
        )}

        {items.map((item) => {
          if (item.kind === 'user') {
            return (
              <View key={item.id} style={[styles.bubble, styles.userBubble]}>
                <Text style={styles.userText}>{item.text}</Text>
              </View>
            );
          }
          if (item.kind === 'error') {
            return (
              <View key={item.id} style={[styles.bubble, styles.errorBubble]}>
                <Text style={styles.errorText}>{item.text}</Text>
              </View>
            );
          }
          return (
            <View key={item.id} style={styles.assistantBlock}>
              <View style={[styles.bubble, styles.assistantBubble]}>
                <Text style={styles.assistantText}>{item.text}</Text>
              </View>
              {item.recommendations.map((rec) => (
                <RecommendationCard
                  key={rec.businessId}
                  rec={rec}
                  joining={joiningId === rec.businessId}
                  onGo={() => goToService(rec.businessId)}
                  onJoin={() => joinQueue(rec)}
                />
              ))}
            </View>
          );
        })}

        {thinking && (
          <View style={[styles.bubble, styles.assistantBubble, styles.thinking]}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.thinkingText}>Finding the best options…</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          mode="outlined"
          style={styles.input}
          placeholder="Ask for a service…"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => send(input)}
          returnKeyType="send"
          dense
          disabled={thinking}
        />
        <IconButton
          icon="send"
          mode="contained"
          containerColor={theme.colors.primary}
          iconColor="#FFFFFF"
          disabled={thinking || !input.trim()}
          onPress={() => send(input)}
        />
      </View>

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={3500}>
        {snack ?? ''}
      </Snackbar>
    </View>
  );
}

function RecommendationCard({
  rec,
  joining,
  onGo,
  onJoin,
}: {
  rec: Recommendation;
  joining: boolean;
  onGo: () => void;
  onJoin: () => void;
}) {
  const rating =
    rec.ratingCount > 0 ? `★ ${rec.ratingAvg.toFixed(1)} (${rec.ratingCount})` : 'No ratings yet';

  return (
    <Card style={styles.recCard} mode="outlined">
      <Card.Title
        title={rec.name}
        titleVariant="titleMedium"
        subtitle={`${categoryLabel(rec.category)} · ${rating}`}
        right={() => (
          <Chip
            compact
            style={[styles.statusChip, { backgroundColor: rec.isOpen ? '#DCFCE7' : '#FEE2E2' }]}
            textStyle={styles.statusChipText}
          >
            {rec.isOpen ? 'Open' : 'Closed'}
          </Chip>
        )}
      />
      <Card.Content style={styles.recContent}>
        <View style={styles.metaRow}>
          <Meta icon="account-group" label={`${rec.queueSize} waiting`} />
          <Meta icon="clock-outline" label={rec.estimatedWaitText} />
        </View>
        {rec.address ? <Meta icon="map-marker-outline" label={rec.address} /> : null}

        {rec.reasons.length > 0 && (
          <View style={styles.reasons}>
            {rec.reasons.map((r) => (
              <Chip key={r} compact style={styles.reasonChip} textStyle={styles.reasonText}>
                {r}
              </Chip>
            ))}
          </View>
        )}
      </Card.Content>
      <Card.Actions>
        <Button onPress={onGo}>Go to service</Button>
        <Button
          mode="contained"
          icon="ticket-confirmation-outline"
          disabled={!rec.isOpen || !rec.topQueueId || joining}
          loading={joining}
          onPress={onJoin}
        >
          Join queue
        </Button>
      </Card.Actions>
    </Card>
  );
}

function Meta({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.meta}>
      <Avatar.Icon
        size={22}
        icon={icon}
        color={theme.colors.onSurfaceVariant}
        style={styles.metaIcon}
      />
      <Text style={styles.metaLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.lg },
  intro: { alignItems: 'center', paddingTop: spacing.lg, gap: spacing.xs },
  introIcon: { backgroundColor: theme.colors.primary },
  introTitle: { fontWeight: '800', marginTop: spacing.sm },
  introBody: { textAlign: 'center', color: theme.colors.onSurfaceVariant, marginBottom: spacing.sm },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  suggestionChip: { backgroundColor: theme.colors.surface },
  bubble: { padding: spacing.md, borderRadius: radius.lg, maxWidth: '92%' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: theme.colors.primary },
  userText: { color: '#FFFFFF' },
  assistantBlock: { gap: spacing.sm, alignSelf: 'stretch' },
  assistantBubble: { alignSelf: 'flex-start', backgroundColor: theme.colors.surfaceVariant },
  assistantText: { color: theme.colors.onSurface },
  errorBubble: { alignSelf: 'flex-start', backgroundColor: '#FEE2E2' },
  errorText: { color: '#B91C1C' },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  thinkingText: { color: theme.colors.onSurfaceVariant },
  recCard: { backgroundColor: theme.colors.surface },
  recContent: { gap: spacing.xs },
  metaRow: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 1 },
  metaIcon: { backgroundColor: 'transparent' },
  metaLabel: { color: theme.colors.onSurfaceVariant, flexShrink: 1 },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  reasonChip: { backgroundColor: theme.colors.primaryContainer },
  reasonText: { fontSize: 11, color: theme.colors.primary },
  statusChip: { marginRight: spacing.md, alignSelf: 'center' },
  statusChipText: { fontSize: 11, fontWeight: '700' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    gap: spacing.xs,
    backgroundColor: theme.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.outline,
  },
  input: { flex: 1, backgroundColor: theme.colors.surface },
});
