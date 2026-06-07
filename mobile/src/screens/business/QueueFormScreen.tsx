/**
 * FlowOS mobile - src/screens/business/QueueFormScreen.tsx
 * Create or edit a queue. No `queue` param => create (POST /businesses/:id/queues);
 * with a `queue` param => edit (PATCH /queues/:id). Uses existing APIs only.
 */
import React, { useState } from 'react';
import { Text, TextInput, Button, HelperText, SegmentedButtons, Snackbar } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Screen from '../../components/Screen';
import { businessApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import type { BusinessStackParamList } from '../../navigation/types';
import type { QueueStatus } from '../../api/types';

type Props = NativeStackScreenProps<BusinessStackParamList, 'QueueForm'>;

export default function QueueFormScreen({ route, navigation }: Props) {
  const { businessId, queue } = route.params;
  const isEdit = !!queue;

  const [name, setName] = useState(queue?.name ?? '');
  const [description, setDescription] = useState(queue?.description ?? '');
  const [minutes, setMinutes] = useState(
    queue ? String(Math.max(1, Math.round(queue.avgServiceSec / 60))) : '5',
  );
  const [capacity, setCapacity] = useState(queue?.maxCapacity ? String(queue.maxCapacity) : '');
  const [status, setStatus] = useState<QueueStatus>(queue?.status ?? 'OPEN');

  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validate = (): string | null => {
    if (name.trim().length < 2 || name.trim().length > 80)
      return 'Queue name must be 2–80 characters';
    if (description.length > 500) return 'Description is too long (max 500)';
    if (minutes.trim()) {
      const m = Number(minutes);
      if (!Number.isInteger(m) || m < 1 || m > 120)
        return 'Average service time must be 1–120 minutes';
    }
    if (capacity.trim()) {
      const c = Number(capacity);
      if (!Number.isInteger(c) || c < 1 || c > 10000) return 'Maximum capacity must be 1–10000';
    }
    return null;
  };

  const onSubmit = async () => {
    setError(null);
    const v = validate();
    if (v) {
      setFieldError(v);
      return;
    }
    setFieldError(null);
    setLoading(true);

    const avgServiceSec = minutes.trim() ? Number(minutes) * 60 : undefined;
    const maxCapacity = capacity.trim() ? Number(capacity) : undefined;

    try {
      if (isEdit) {
        await businessApi.updateQueue(queue!.id, {
          name: name.trim(),
          description: description.trim(),
          avgServiceSec,
          maxCapacity,
          status,
        });
        setSuccess(true);
        setTimeout(() => navigation.goBack(), 800);
      } else {
        const created = await businessApi.createQueue(businessId, {
          name: name.trim(),
          description: description.trim() || undefined,
          avgServiceSec,
          maxCapacity,
        });
        // The create endpoint can't set status; apply a non-default status with a follow-up PATCH.
        if (status !== 'OPEN') await businessApi.updateQueue(created.id, { status });
        setSuccess(true);
        // Drop the form from the stack and open Queue Manager for the new queue.
        setTimeout(
          () => navigation.replace('QueueManager', { queueId: created.id, queueName: created.name }),
          700,
        );
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <TextInput label="Queue name" mode="outlined" value={name} onChangeText={setName} />
      <TextInput
        label="Description (optional)"
        mode="outlined"
        multiline
        numberOfLines={3}
        value={description}
        onChangeText={setDescription}
      />
      <TextInput
        label="Average service time (minutes)"
        mode="outlined"
        keyboardType="number-pad"
        value={minutes}
        onChangeText={setMinutes}
      />
      <TextInput
        label="Maximum capacity (optional)"
        mode="outlined"
        keyboardType="number-pad"
        value={capacity}
        onChangeText={setCapacity}
      />

      <Text variant="labelLarge">Status</Text>
      <SegmentedButtons
        value={status}
        onValueChange={(val) => setStatus(val as QueueStatus)}
        buttons={[
          { value: 'OPEN', label: 'Open' },
          { value: 'PAUSED', label: 'Paused' },
          { value: 'CLOSED', label: 'Closed' },
        ]}
      />

      {(fieldError || error) && <HelperText type="error">{fieldError ?? error}</HelperText>}

      <Button mode="contained" loading={loading} disabled={loading} onPress={onSubmit}>
        {isEdit ? 'Save changes' : 'Create queue'}
      </Button>

      <Snackbar visible={success} onDismiss={() => setSuccess(false)} duration={800}>
        {isEdit ? 'Queue updated' : 'Queue created 🎉'}
      </Snackbar>
    </Screen>
  );
}
