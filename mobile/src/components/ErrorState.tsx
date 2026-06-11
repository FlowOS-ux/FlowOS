/**
 * FlowOS mobile - src/components/ErrorState.tsx
 * Reusable inline error block with a Retry button, so a failed fetch no longer
 * dead-ends the user at a static "Network Error" string with no way forward
 * except a manual app refresh.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { theme, spacing } from '../theme';

interface Props {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}

export default function ErrorState({ message, onRetry, retrying }: Props) {
  return (
    <View style={styles.root}>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <Button mode="contained-tonal" icon="refresh" loading={retrying} onPress={onRetry}>
          Try again
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  message: { textAlign: 'center', color: theme.colors.onSurfaceVariant },
});
