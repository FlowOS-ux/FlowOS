/**
 * FlowOS mobile - src/components/ThumbnailPicker.web.tsx
 * Web variant: pick an image file from the device, upload it to the backend, and
 * report the hosted URL via onChange. Shows a live preview.
 */
import React, { useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { mediaApi } from '../api/endpoints';
import { apiErrorMessage } from '../api/client';
import { resolveMediaUri } from '../lib/images';
import { theme, spacing, radius } from '../theme';

// `document` is a browser global (this file is only bundled for web); the React
// Native type lib doesn't include DOM, so declare the minimal shape we use.
declare const document: {
  createElement(tag: string): {
    type: string;
    accept: string;
    onchange: (() => void | Promise<void>) | null;
    files: { readonly length: number; [index: number]: unknown } | null;
    click(): void;
  };
};

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
}

export default function ThumbnailPicker({ value, onChange, label = 'Business thumbnail' }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      setError(null);
      setUploading(true);
      try {
        const form = new FormData();
        form.append('file', file);
        const url = await mediaApi.upload(form);
        onChange(url);
      } catch (err) {
        setError(apiErrorMessage(err));
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  return (
    <View style={styles.wrap}>
      <Text variant="labelLarge">{label}</Text>
      {value ? (
        <Image source={{ uri: resolveMediaUri(value) }} style={styles.preview} resizeMode="cover" />
      ) : (
        <View style={[styles.preview, styles.placeholder]}>
          <Text style={styles.muted}>No image selected</Text>
        </View>
      )}
      <View style={styles.row}>
        <Button
          mode="contained-tonal"
          icon="image-plus"
          onPress={pick}
          loading={uploading}
          disabled={uploading}
        >
          {value ? 'Change image' : 'Upload image'}
        </Button>
        {value && !uploading ? (
          <Button onPress={() => onChange(null)} textColor={theme.colors.error}>
            Remove
          </Button>
        ) : null}
      </View>
      {error ? (
        <Text variant="bodySmall" style={styles.err}>
          {error}
        </Text>
      ) : null}
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
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  muted: { color: theme.colors.onSurfaceVariant },
  err: { color: theme.colors.error },
});
