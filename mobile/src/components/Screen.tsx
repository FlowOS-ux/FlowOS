/**
 * FlowOS mobile - src/components/Screen.tsx
 * Consistent screen container with themed background and padding.
 */
import React from 'react';
import { ScrollView, View, StyleSheet, RefreshControl } from 'react-native';
import { theme, spacing } from '../theme';

interface Props {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export default function Screen({ children, scroll, padded = true, refreshing, onRefresh }: Props) {
  const content = padded ? <View style={styles.padded}>{children}</View> : children;

  if (scroll) {
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.grow}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined
        }
      >
        {content}
      </ScrollView>
    );
  }
  return <View style={[styles.root, styles.grow]}>{content}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  grow: { flexGrow: 1 },
  padded: { padding: spacing.md, gap: spacing.md },
});
