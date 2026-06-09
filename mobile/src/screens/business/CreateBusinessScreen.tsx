/**
 * FlowOS mobile - src/screens/business/CreateBusinessScreen.tsx
 * Business owner creates a new business (status starts as DRAFT; activation is part
 * of Business Setup). Uses the existing POST /businesses API.
 */
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, Button, HelperText, Chip, Snackbar } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Screen from '../../components/Screen';
import ThumbnailPicker from '../../components/ThumbnailPicker';
import { businessApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { theme, spacing } from '../../theme';
import type { BusinessStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<BusinessStackParamList, 'CreateBusiness'>;

const CATEGORIES = ['HOSPITAL', 'BANK', 'RESTAURANT', 'SALON', 'GOVERNMENT', 'OTHER'];

export default function CreateBusinessScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validate = (): string | null => {
    if (name.trim().length < 2 || name.trim().length > 120)
      return 'Business name must be 2–120 characters';
    if (!category) return 'Please choose a category';
    if (description.length > 1000) return 'Description is too long (max 1000)';
    if (address.length > 200) return 'Address is too long (max 200)';
    if (phone.length > 20) return 'Phone number is too long (max 20)';

    const hasLat = lat.trim() !== '';
    const hasLng = lng.trim() !== '';
    if (hasLat !== hasLng) return 'Provide both latitude and longitude, or neither';
    if (hasLat) {
      const latN = Number(lat);
      const lngN = Number(lng);
      if (Number.isNaN(latN) || latN < -90 || latN > 90)
        return 'Latitude must be between -90 and 90';
      if (Number.isNaN(lngN) || lngN < -180 || lngN > 180)
        return 'Longitude must be between -180 and 180';
    }
    return null;
  };

  const onSubmit = async () => {
    setError(null);
    const validationError = validate();
    if (validationError) {
      setFieldError(validationError);
      return;
    }
    setFieldError(null);
    setLoading(true);
    try {
      await businessApi.create({
        name: name.trim(),
        category,
        description: description.trim() || undefined,
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        logoUrl: logoUrl ?? undefined,
        location: lat.trim() ? { lat: Number(lat), lng: Number(lng) } : undefined,
      });
      setSuccess(true);
      // Return to the dashboard, which refetches on focus and shows the new (DRAFT) business.
      setTimeout(() => navigation.goBack(), 900);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <TextInput label="Business name" mode="outlined" value={name} onChangeText={setName} />

      <Text variant="labelLarge">Category</Text>
      <View style={styles.chips}>
        {CATEGORIES.map((c) => (
          <Chip key={c} selected={category === c} onPress={() => setCategory(c)} showSelectedOverlay>
            {c.charAt(0) + c.slice(1).toLowerCase()}
          </Chip>
        ))}
      </View>

      <ThumbnailPicker value={logoUrl} onChange={setLogoUrl} label="Thumbnail image (optional)" />

      <TextInput
        label="Description (optional)"
        mode="outlined"
        multiline
        numberOfLines={3}
        value={description}
        onChangeText={setDescription}
      />
      <TextInput
        label="Address (optional)"
        mode="outlined"
        value={address}
        onChangeText={setAddress}
      />
      <TextInput
        label="Phone (optional)"
        mode="outlined"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />

      <Text variant="labelLarge">Location (optional)</Text>
      <View style={styles.row}>
        <TextInput
          label="Latitude"
          mode="outlined"
          keyboardType="numbers-and-punctuation"
          style={styles.flex}
          value={lat}
          onChangeText={setLat}
        />
        <TextInput
          label="Longitude"
          mode="outlined"
          keyboardType="numbers-and-punctuation"
          style={styles.flex}
          value={lng}
          onChangeText={setLng}
        />
      </View>

      {(fieldError || error) && <HelperText type="error">{fieldError ?? error}</HelperText>}

      <Button mode="contained" loading={loading} disabled={loading} onPress={onSubmit}>
        Create business
      </Button>
      <Text variant="bodySmall" style={styles.note}>
        Your business starts as a draft. You can add hours and activate it from Business Setup.
      </Text>

      <Snackbar visible={success} onDismiss={() => setSuccess(false)} duration={900}>
        Business created 🎉
      </Snackbar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  note: { color: theme.colors.onSurfaceVariant, textAlign: 'center' },
});
