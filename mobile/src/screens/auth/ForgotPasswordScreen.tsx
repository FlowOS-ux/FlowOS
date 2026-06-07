/**
 * FlowOS mobile - src/screens/auth/ForgotPasswordScreen.tsx
 * Two-phase password reset against the existing auth API:
 *   request -> POST /auth/forgot-password { email }   (emails a token, 1h expiry)
 *   reset   -> POST /auth/reset-password  { token, password }
 * The token has the form "<userId>.<rawToken>"; in dev the email service logs it
 * to the backend console.
 */
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, Button, HelperText, Snackbar } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Screen from '../../components/Screen';
import { authApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { theme, spacing } from '../../theme';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;
type Step = 'request' | 'reset';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const onRequest = async () => {
    setError(null);
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address');
      return;
    }
    setLoading(true);
    try {
      await authApi.forgotPassword(email.trim());
      // Always succeeds (never reveals whether the email exists). Move to reset.
      setStep('reset');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const onReset = async () => {
    setError(null);
    if (token.trim().length < 10) {
      setError('Paste the reset code from your email');
      return;
    }
    if (password.length < 8 || password.length > 128) {
      setError('Password must be 8–128 characters');
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword(token.trim(), password);
      setSuccess(true);
      // Password reset revokes sessions; send the user back to log in.
      setTimeout(() => navigation.navigate('Login'), 1000);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.title}>
          Reset password
        </Text>
        <Text variant="bodyMedium" style={styles.muted}>
          {step === 'request'
            ? "Enter your account email and we'll send a reset code."
            : 'Enter the reset code from your email and choose a new password.'}
        </Text>
      </View>

      {step === 'request' ? (
        <>
          <TextInput
            label="Email"
            mode="outlined"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          {error && <HelperText type="error">{error}</HelperText>}
          <Button mode="contained" loading={loading} disabled={loading} onPress={onRequest}>
            Send reset code
          </Button>
          <Button onPress={() => setStep('reset')}>I already have a code</Button>
        </>
      ) : (
        <>
          <TextInput
            label="Reset code"
            mode="outlined"
            autoCapitalize="none"
            value={token}
            onChangeText={setToken}
          />
          <TextInput
            label="New password"
            mode="outlined"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          {error && <HelperText type="error">{error}</HelperText>}
          <Button mode="contained" loading={loading} disabled={loading} onPress={onReset}>
            Update password
          </Button>
          <Button onPress={() => setStep('request')}>Resend code</Button>
        </>
      )}

      <Button onPress={() => navigation.navigate('Login')}>Back to login</Button>

      <Snackbar visible={success} onDismiss={() => setSuccess(false)} duration={1000}>
        Password updated — please log in.
      </Snackbar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: spacing.xl, marginBottom: spacing.md, gap: spacing.xs },
  title: { fontWeight: '800' },
  muted: { color: theme.colors.onSurfaceVariant },
});
