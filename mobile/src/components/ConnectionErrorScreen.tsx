/**
 * FlowOS mobile - src/components/ConnectionErrorScreen.tsx
 * Shown on launch when a saved session could not be restored because the backend
 * was unreachable (cold start / restart / offline). The session is preserved — we
 * retry automatically in the background and offer a manual retry — so the user is
 * NOT bounced to the login screen for a transient blip.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, ActivityIndicator, Avatar } from 'react-native-paper';
import { theme, spacing } from '../theme';

export default function ConnectionErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.root}>
      <Avatar.Icon size={88} icon="wifi-off" color="#FFFFFF" style={styles.logo} />
      <Text variant="headlineSmall" style={styles.title}>
        Can&apos;t reach FlowOS
      </Text>
      <Text variant="bodyMedium" style={styles.body}>
        We&apos;re having trouble connecting to the server. This usually clears up in a few
        seconds — we&apos;ll keep trying automatically.
      </Text>
      <ActivityIndicator color={theme.colors.primary} style={styles.spinner} />
      <Button mode="contained" icon="refresh" onPress={onRetry} style={styles.button}>
        Try now
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  logo: { backgroundColor: theme.colors.error, marginBottom: spacing.sm },
  title: { fontWeight: '800', color: theme.colors.onBackground },
  body: { color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: spacing.xs },
  spinner: { marginTop: spacing.lg },
  button: { marginTop: spacing.lg },
});
