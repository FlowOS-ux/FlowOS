/**
 * FlowOS mobile - src/components/Splash.tsx
 * Branded splash shown while the session is restored on launch.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, ActivityIndicator, Avatar } from 'react-native-paper';
import { theme, spacing } from '../theme';

export default function Splash() {
  return (
    <View style={styles.root}>
      <Avatar.Icon size={104} icon="ticket-confirmation" color="#FFFFFF" style={styles.logo} />
      <Text variant="displaySmall" style={styles.brand}>
        FlowOS
      </Text>
      <Text variant="bodyLarge" style={styles.tagline}>
        Skip the line. Join queues from anywhere.
      </Text>
      <ActivityIndicator color={theme.colors.primary} style={styles.spinner} />
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
  logo: { backgroundColor: theme.colors.primary, marginBottom: spacing.sm },
  brand: { fontWeight: '800', color: theme.colors.primary },
  tagline: { color: theme.colors.onSurfaceVariant, textAlign: 'center' },
  spinner: { marginTop: spacing.xl },
});
