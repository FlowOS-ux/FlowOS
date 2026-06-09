/**
 * FlowOS mobile - src/screens/auth/VerifyEmailScreen.tsx
 * Entered after sign-up (or a login attempt on an unverified account). The user
 * types the 6-digit code emailed to them; a correct code signs them in.
 */
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, Button, HelperText, Avatar } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Screen from '../../components/Screen';
import { useAuth } from '../../auth/AuthContext';
import { apiErrorMessage } from '../../api/client';
import { theme, spacing } from '../../theme';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'VerifyEmail'>;

export default function VerifyEmailScreen({ route, navigation }: Props) {
  const { email, devCode } = route.params;
  const { verifyEmail, resendOtp } = useAuth();
  // Demo backends return the code so testers can verify without an inbox; prefill it.
  const [otp, setOtp] = useState(devCode ?? '');
  const [demoCode, setDemoCode] = useState<string | undefined>(devCode);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const onVerify = async () => {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await verifyEmail(email, otp.trim());
      // On success the auth state flips and RootNavigator swaps to the app tree.
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    setError(null);
    setInfo(null);
    setResending(true);
    try {
      const { devCode: fresh } = await resendOtp(email);
      if (fresh) {
        // Demo mode: reveal + prefill the new code.
        setDemoCode(fresh);
        setOtp(fresh);
        setInfo('A new code was generated and filled in below.');
      } else {
        setInfo('A new code has been sent to your email.');
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Avatar.Icon size={72} icon="email-check-outline" color="#FFFFFF" style={styles.logo} />
        <Text variant="headlineMedium" style={styles.bold}>
          Verify your email
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          We sent a 6-digit code to {email}. Enter it below to activate your account.
        </Text>
      </View>

      {demoCode && (
        <View style={styles.demoBanner}>
          <Text variant="labelLarge" style={styles.demoText}>
            Demo mode — your code is {demoCode}
          </Text>
          <Text variant="bodySmall">It&apos;s filled in below; just tap Verify.</Text>
        </View>
      )}

      <TextInput
        label="6-digit code"
        mode="outlined"
        keyboardType="number-pad"
        maxLength={6}
        value={otp}
        onChangeText={(v) => setOtp(v.replace(/[^0-9]/g, ''))}
      />
      {error && <HelperText type="error">{error}</HelperText>}
      {info && <HelperText type="info">{info}</HelperText>}

      <Button
        mode="contained"
        loading={loading}
        disabled={loading || otp.length !== 6}
        onPress={onVerify}
      >
        Verify
      </Button>
      <Button onPress={onResend} loading={resending} disabled={resending}>
        Didn&apos;t get it? Resend code
      </Button>
      <Button onPress={() => navigation.navigate('Login')}>Back to log in</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginBottom: spacing.lg, marginTop: spacing.xl, gap: spacing.xs },
  logo: { backgroundColor: theme.colors.primary, marginBottom: spacing.sm },
  bold: { fontWeight: '800' },
  subtitle: { textAlign: 'center' },
  demoBanner: {
    backgroundColor: theme.colors.primaryContainer,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: 2,
  },
  demoText: { fontWeight: '700' },
});
