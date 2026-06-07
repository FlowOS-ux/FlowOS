/**
 * FlowOS mobile - src/screens/shared/ProfileScreen.tsx
 * Profile + settings summary + logout.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { Avatar, Text, Card, Button, List } from 'react-native-paper';
import Screen from '../../components/Screen';
import { useAuth } from '../../auth/AuthContext';
import { theme, spacing } from '../../theme';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Screen scroll>
      <Card style={styles.card}>
        <Card.Content style={styles.header}>
          <Avatar.Text size={64} label={initials} />
          <Text variant="titleLarge" style={styles.name}>
            {user.name}
          </Text>
          <Text variant="bodyMedium" style={styles.muted}>
            {user.email}
          </Text>
          <Text variant="labelLarge" style={styles.role}>
            {user.role.replace('_', ' ')}
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <List.Item title="Phone" description={user.phone ?? 'Not set'} left={(p) => <List.Icon {...p} icon="phone" />} />
        <List.Item
          title="Language"
          description={user.settings.language}
          left={(p) => <List.Icon {...p} icon="translate" />}
        />
        <List.Item
          title="Notifications"
          description={user.settings.notificationsEnabled ? 'On' : 'Off'}
          left={(p) => <List.Icon {...p} icon="bell" />}
        />
      </Card>

      <Button mode="contained" buttonColor={theme.colors.error} onPress={logout}>
        Log out
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.colors.surface },
  header: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  name: { fontWeight: '800', marginTop: spacing.sm },
  muted: { color: theme.colors.onSurfaceVariant },
  role: { color: theme.colors.primary, marginTop: spacing.xs },
});
