/**
 * FlowOS mobile - src/components/ThumbnailPicker.tsx
 * Native fallback: paste an image URL (a native gallery/camera picker can be added
 * later with react-native-image-picker, uploading via mediaApi.upload). The web
 * build uses ThumbnailPicker.web.tsx, which uploads a chosen file directly.
 */
import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { resolveMediaUri } from '../lib/images';
import { theme, spacing, radius } from '../theme';

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
}

export default function ThumbnailPicker({ value, onChange, label = 'Business thumbnail' }: Props) {
  return (
    <View style={styles.wrap}>
      <Text variant="labelLarge">{label}</Text>
      {value ? (
        <Image source={{ uri: resolveMediaUri(value) }} style={styles.preview} resizeMode="cover" />
      ) : null}
      <TextInput
        label="Image URL (optional)"
        mode="outlined"
        autoCapitalize="none"
        keyboardType="url"
        value={value ?? ''}
        onChangeText={(t) => onChange(t.trim() ? t.trim() : null)}
      />
      <Text variant="bodySmall" style={styles.muted}>
        Paste an image URL. (Uploading from your gallery is available in the web app.)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  preview: {
    width: '100%',
    height: 150,
    borderRadius: radius.md,
    backgroundColor: theme.colors.surfaceVariant,
  },
  muted: { color: theme.colors.onSurfaceVariant },
});
