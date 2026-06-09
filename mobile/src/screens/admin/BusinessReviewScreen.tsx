/**
 * FlowOS mobile - src/screens/admin/BusinessReviewScreen.tsx
 * Platform-admin review of a single business. Shows business + owner details.
 * For a PENDING_VERIFICATION business: Approve -> APPROVED, or Reject (+ optional
 * reason) -> REJECTED. Approved/rejected businesses are shown read-only with audit.
 */
import React, { useState } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import {
  Text,
  Button,
  Chip,
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
import { theme, spacing, statusColors, businessStatusLabels } from '../../theme';
import type { AdminStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AdminStackParamList, 'BusinessReview'>;

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '';
  }
}

export default function BusinessReviewScreen({ route, navigation }: Props) {
  const { business } = route.params;
  const isPending = business.status === 'PENDING_VERIFICATION';

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
      setSuccess('Approved — business is now live 🎉');
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
      setSuccess('Business rejected');
      setTimeout(() => navigation.goBack(), 800);
    } catch (err) {
      setRejectVisible(false);
      setError(apiErrorMessage(err));
      setRejecting(false);
    }
  };

  return (
    <Screen scroll>
      {business.logoUrl ? (
        <Image source={{ uri: business.logoUrl }} style={styles.cover} resizeMode="cover" />
      ) : null}

      <View style={styles.titleRow}>
        <Text variant="headlineSmall" style={styles.flex}>
          {business.name}
        </Text>
        <Chip
          compact
          textStyle={styles.chipText}
          style={{ backgroundColor: statusColors[business.status] }}
        >
          {businessStatusLabels[business.status] ?? business.status}
        </Chip>
      </View>

      <Divider style={styles.divider} />
      <Text variant="titleMedium">Owner</Text>
      <Field label="Name" value={business.owner.name} />
      <Field label="Email" value={business.owner.email} />
      <Field label="Phone" value={business.owner.phone} />

      <Divider style={styles.divider} />
      <Text variant="titleMedium">Business</Text>
      <Field label="Category" value={business.category} />
      <Field label="Description" value={business.description} />
      <Field label="Address" value={business.address} />
      <Field label="Business phone" value={business.phone} />
      <Field label="Submitted" value={formatDate(business.submittedAt)} />

      {business.status === 'APPROVED' && business.approvedAt ? (
        <Field label="Approved" value={formatDate(business.approvedAt)} />
      ) : null}
      {business.status === 'REJECTED' ? (
        <>
          <Field label="Rejected" value={formatDate(business.rejectedAt)} />
          <Field label="Reason" value={business.rejectionReason} />
        </>
      ) : null}

      {error && <HelperText type="error">{error}</HelperText>}

      {isPending ? (
        <>
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
        </>
      ) : null}

      <Portal>
        <Dialog visible={rejectVisible} onDismiss={() => setRejectVisible(false)}>
          <Dialog.Title>Reject business?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={styles.dialogText}>
              Optionally record a reason (shown to the owner).
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
            <Button
              onPress={onReject}
              loading={rejecting}
              disabled={rejecting}
              textColor={theme.colors.error}
            >
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
  flex: { flex: 1 },
  cover: { width: '100%', height: 160, borderRadius: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chipText: { color: '#FFFFFF', fontWeight: '700' },
  muted: { color: theme.colors.onSurfaceVariant },
  divider: { marginVertical: spacing.sm },
  field: { marginBottom: spacing.sm },
  approve: { marginTop: spacing.sm },
  reject: { marginTop: spacing.sm, borderColor: theme.colors.error },
  dialogText: { marginBottom: spacing.sm },
});
