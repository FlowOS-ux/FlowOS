/**
 * FlowOS mobile - src/screens/business/BusinessSetupScreen.tsx
 * Business Setup + Activation. Lets an owner/manager edit profile basics, set a
 * 7-day opening-hours schedule, and flip the business to ACTIVE so it becomes
 * discoverable in Explore. Wired to PATCH /businesses/:id (no new backend needed).
 */
import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Text,
  TextInput,
  Button,
  HelperText,
  Switch,
  Chip,
  Divider,
  Snackbar,
  Dialog,
  Portal,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Screen from '../../components/Screen';
import ThumbnailPicker from '../../components/ThumbnailPicker';
import { businessApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { theme, spacing, statusColors, businessStatusLabels } from '../../theme';
import type { BusinessHour } from '../../api/types';
import type { BusinessStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<BusinessStackParamList, 'BusinessSetup'>;

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_RE = /^\d{2}:\d{2}$/;
const DEFAULT_OPEN = '09:00';
const DEFAULT_CLOSE = '17:00';

/** Build a stable 7-row schedule (Sun..Sat), prefilled from saved hours. */
function buildHours(saved: BusinessHour[]): Required<BusinessHour>[] {
  return DAYS.map((_, dayOfWeek) => {
    const existing = saved.find((h) => h.dayOfWeek === dayOfWeek);
    return {
      dayOfWeek,
      openTime: existing?.openTime ?? DEFAULT_OPEN,
      closeTime: existing?.closeTime ?? DEFAULT_CLOSE,
      isClosed: existing?.isClosed ?? false,
    };
  });
}

/** "HH:MM" -> minutes since midnight, or null if malformed. */
function toMinutes(value: string): number | null {
  if (!TIME_RE.test(value)) return null;
  const [h, m] = value.split(':').map(Number);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export default function BusinessSetupScreen({ route, navigation }: Props) {
  const { business } = route.params;

  const [name, setName] = useState(business.name);
  const [description, setDescription] = useState(business.description ?? '');
  const [address, setAddress] = useState(business.address ?? '');
  const [phone, setPhone] = useState(business.phone ?? '');
  const [logoUrl, setLogoUrl] = useState<string | null>(business.logoUrl ?? null);
  const [hours, setHours] = useState<Required<BusinessHour>[]>(() => buildHours(business.hours));

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Status (PENDING_VERIFICATION / APPROVED / REJECTED) is admin-controlled and
  // read-only here — owners can edit profile/hours but cannot change status.
  const status = business.status;

  const updateDay = (index: number, patch: Partial<Required<BusinessHour>>) => {
    setHours((prev) => prev.map((day, i) => (i === index ? { ...day, ...patch } : day)));
  };

  const validate = (): string | null => {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 120) return 'Business name must be 2–120 characters';
    if (description.length > 1000) return 'Description is too long (max 1000)';
    if (address.length > 200) return 'Address is too long (max 200)';
    if (phone.length > 20) return 'Phone number is too long (max 20)';

    for (const day of hours) {
      if (day.isClosed) continue;
      const open = toMinutes(day.openTime);
      const close = toMinutes(day.closeTime);
      if (open === null || close === null) {
        return `${DAYS[day.dayOfWeek]}: use 24h HH:MM (e.g. 09:00)`;
      }
      if (close <= open) {
        return `${DAYS[day.dayOfWeek]}: closing time must be after opening time`;
      }
    }
    return null;
  };

  /** Profile + hours payload. Status is never sent — it's admin/lifecycle-controlled. */
  const buildUpdateBody = () => ({
    name: name.trim(),
    description: description.trim() || undefined,
    address: address.trim() || undefined,
    phone: phone.trim() || undefined,
    logoUrl: logoUrl ?? undefined,
    // Closed days drop their times; open days send both.
    hours: hours.map((day) =>
      day.isClosed
        ? { dayOfWeek: day.dayOfWeek, isClosed: true }
        : {
            dayOfWeek: day.dayOfWeek,
            openTime: day.openTime,
            closeTime: day.closeTime,
            isClosed: false,
          },
    ),
  });

  const onSave = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await businessApi.update(business.id, buildUpdateBody());
      setSuccess(true);
      // Dashboard refetches on focus and reflects the saved details.
      setTimeout(() => navigation.goBack(), 900);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async () => {
    setError(null);
    setDeleting(true);
    try {
      await businessApi.remove(business.id);
      setConfirmVisible(false);
      // Dashboard refetches on focus and the business is gone.
      navigation.goBack();
    } catch (err) {
      setConfirmVisible(false);
      setError(apiErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const statusNote = useMemo(() => {
    switch (status) {
      case 'APPROVED':
        return 'Approved — visible in Explore and open for customers to join queues.';
      case 'REJECTED':
        return 'Not approved by the review team. See the reason below.';
      default:
        return 'Your business is awaiting admin approval. You can still update its details.';
    }
  }, [status]);

  return (
    <Screen scroll>
      {/* Verification status */}
      <View style={styles.statusHeader}>
        <Text variant="titleMedium">Status</Text>
        <Chip compact textStyle={styles.chipText} style={{ backgroundColor: statusColors[status] }}>
          {businessStatusLabels[status] ?? status}
        </Chip>
      </View>
      <HelperText type="info" visible>
        {statusNote}
      </HelperText>
      {status === 'REJECTED' && business.rejectionReason ? (
        <View style={styles.rejectionBox}>
          <Text variant="labelLarge" style={styles.rejectionTitle}>
            Reason for rejection
          </Text>
          <Text variant="bodySmall">{business.rejectionReason}</Text>
        </View>
      ) : null}

      <Divider style={styles.divider} />

      {/* Profile basics */}
      <Text variant="titleMedium">Details</Text>
      <TextInput label="Business name" mode="outlined" value={name} onChangeText={setName} />
      <TextInput
        label="Description (optional)"
        mode="outlined"
        multiline
        numberOfLines={3}
        value={description}
        onChangeText={setDescription}
      />
      <TextInput label="Address (optional)" mode="outlined" value={address} onChangeText={setAddress} />
      <TextInput
        label="Phone (optional)"
        mode="outlined"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />

      <ThumbnailPicker value={logoUrl} onChange={setLogoUrl} label="Thumbnail image" />

      <Divider style={styles.divider} />

      {/* Hours */}
      <Text variant="titleMedium">Opening hours</Text>
      {hours.map((day, index) => (
        <View key={day.dayOfWeek} style={styles.dayRow}>
          <Text variant="bodyMedium" style={styles.dayLabel}>
            {DAYS[day.dayOfWeek].slice(0, 3)}
          </Text>
          {day.isClosed ? (
            <Text variant="bodyMedium" style={[styles.flex, styles.muted]}>
              Closed
            </Text>
          ) : (
            <View style={styles.timeInputs}>
              <TextInput
                mode="outlined"
                dense
                placeholder="09:00"
                maxLength={5}
                keyboardType="numbers-and-punctuation"
                style={styles.timeInput}
                value={day.openTime}
                onChangeText={(v) => updateDay(index, { openTime: v })}
              />
              <Text style={styles.muted}>–</Text>
              <TextInput
                mode="outlined"
                dense
                placeholder="17:00"
                maxLength={5}
                keyboardType="numbers-and-punctuation"
                style={styles.timeInput}
                value={day.closeTime}
                onChangeText={(v) => updateDay(index, { closeTime: v })}
              />
            </View>
          )}
          <View style={styles.closedToggle}>
            <Text variant="labelSmall" style={styles.muted}>
              Closed
            </Text>
            <Switch
              value={day.isClosed}
              onValueChange={(v) => updateDay(index, { isClosed: v })}
            />
          </View>
        </View>
      ))}

      {error && <HelperText type="error">{error}</HelperText>}

      <Button
        mode="contained"
        loading={loading}
        disabled={loading}
        onPress={onSave}
        style={styles.save}
      >
        Save changes
      </Button>

      <Divider style={styles.divider} />
      <Button
        mode="outlined"
        icon="trash-can-outline"
        textColor={theme.colors.error}
        onPress={() => setConfirmVisible(true)}
        style={styles.deleteBtn}
      >
        Delete business
      </Button>
      <Text variant="bodySmall" style={[styles.muted, styles.deleteNote]}>
        Permanently removes this business, its queues, and staff access.
      </Text>

      <Portal>
        <Dialog visible={confirmVisible} onDismiss={() => setConfirmVisible(false)}>
          <Dialog.Title>Delete business?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Permanently delete {business.name}, its queues, and staff access? This cannot be undone.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmVisible(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              onPress={onDelete}
              loading={deleting}
              disabled={deleting}
              textColor={theme.colors.error}
            >
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={success} onDismiss={() => setSuccess(false)} duration={900}>
        Business updated 🎉
      </Snackbar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  muted: { color: theme.colors.onSurfaceVariant },
  divider: { marginVertical: spacing.xs },
  statusHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chipText: { color: '#FFFFFF', fontWeight: '700' },
  rejectionBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  rejectionTitle: { color: theme.colors.error, marginBottom: 2 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayLabel: { width: 36, fontWeight: '700' },
  timeInputs: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  timeInput: { flex: 1 },
  closedToggle: { alignItems: 'center' },
  save: { marginTop: spacing.sm },
  deleteBtn: { marginTop: spacing.sm, borderColor: theme.colors.error },
  deleteNote: { textAlign: 'center' },
});
