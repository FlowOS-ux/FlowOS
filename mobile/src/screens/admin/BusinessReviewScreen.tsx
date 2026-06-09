/**
 * FlowOS mobile - src/screens/admin/BusinessReviewScreen.tsx
 * Platform-admin review of a single PENDING_VERIFICATION business.
 * Approve -> ACTIVE (discoverable + joinable). Reject -> REJECTED (+ optional reason).
 */
import React, { useState } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import {
  Text,
  Button,
  Divider,
  HelperText,
  Snackbar,
  Dialog,
  Portal,
  TextInput,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Screen from '../../components/Screen';
import { adminApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { theme, spacing } from '../../theme';
import type { AdminStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AdminStackParamList, 'BusinessReview'>;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function BusinessReviewScreen({ route, navigation }: Props) {
  const { business } = route.params;

  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectVisible, setRejectVisible] = useState(false);
  const [reason, setReason] = useState('');
  const [success, setSuccess] = useState<string | null>(null);

  const busy = approving || rejecting;

  const onApprove = async () => {
    setError(null);
    setApproving(true);
    try {
      await adminApi.approveBusiness(business.id);
      setSuccess('Approved — now live 🎉');
      setTimeout(() => navigation.goBack(), 800);
    } catch (err) {
      setError(apiErrorMessage(err));
      setApproving(false);
    }
  };

  const onReject = async () => {
    setError(null);
    setRejecting(true);
    try {
      await adminApi.rejectBusiness(business.id, reason.trim() || undefined);
      setRejectVisible(false);
      setSuccess('Rejected');
      setTimeout(() => navigation.goBack(), 800);
    } catch (err) {
      setRejectVisible(false);
      setError(apiErrorMessage(err));
      setRejecting(false);
    }
  };

  const openHours = business.hours.filter((h) => !h.isClosed);

  return (
    <Screen scroll>
      {business.logoUrl ? (
        <Image source={{ uri: business.logoUrl }} style={styles.cover} resizeMode="cover" />
      ) : null}

      <Text variant="headlineSmall">{business.name}</Text>
      <Text variant="bodyMedium" style={styles.muted}>
        {business.category}
      </Text>

      <Divider style={styles.divider} />

      <Field label="Description" value={business.description} />
      <Field label="Address" value={business.address} />
      <Field label="Phone" value={business.phone} />
      <Field
        label="Location"
        value={
          business.location && (business.location.lat || business.location.lng)
            ? `${business.location.lat.toFixed(4)}, ${business.location.lng.toFixed(4)}`
            : null
        }
      />

      <Text variant="labelLarge" style={styles.hoursTitle}>
        Opening hours
      </Text>
      {openHours.length === 0 ? (
        <Text variant="bodySmall" style={styles.muted}>
          No open days set.
        </Text>
      ) : (
        openHours
          .slice()
          .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
          .map((h) => (
            <Text key={h.dayOfWeek} variant="bodySmall">
              {DAYS[h.dayOfWeek]}: {h.openTime} – {h.closeTime}
            </Text>
          ))
      )}

      {error && <HelperText type="error">{error}</HelperText>}

      <Divider style={styles.divider} />

      <Button
        mode="contained"
        icon="check-circle-outline"
        loading={approving}
        disabled={busy}
        onPress={onApprove}
        style={styles.approve}
      >
        Approve &amp; publish
      </Button>
      <Button
        mode="outlined"
        icon="close-circle-outline"
        textColor={theme.colors.error}
        disabled={busy}
        onPress={() => setRejectVisible(true)}
        style={styles.reject}
      >
        Reject
      </Button>

      <Portal>
        <Dialog visible={rejectVisible} onDismiss={() => setRejectVisible(false)}>
          <Dialog.Title>Reject business?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogText}>
              Optionally tell the owner what to fix. They can update and resubmit.
            </Text>
            <TextInput
              mode="outlined"
              label="Reason (optional)"
              multiline
              numberOfLines={3}
              value={reason}
              onChangeText={setReason}
              maxLength={500}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRejectVisible(false)} disabled={rejecting}>
              Cancel
            </Button>
            <Button onPress={onReject} loading={rejecting} disabled={rejecting} textColor={theme.colors.error}>
              Reject
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={!!success} onDismiss={() => setSuccess(null)} duration={800}>
        {success ?? ''}
      </Snackbar>
    </Screen>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.field}>
      <Text variant="labelLarge">{label}</Text>
      <Text variant="bodyMedium" style={value ? undefined : styles.muted}>
        {value || 'Not provided'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { width: '100%', height: 160, borderRadius: 8 },
  muted: { color: theme.colors.onSurfaceVariant },
  divider: { marginVertical: spacing.sm },
  field: { marginBottom: spacing.sm },
  hoursTitle: { marginTop: spacing.xs, marginBottom: spacing.xs },
  approve: { marginTop: spacing.sm },
  reject: { marginTop: spacing.sm, borderColor: theme.colors.error },
  dialogText: { marginBottom: spacing.sm },
});
