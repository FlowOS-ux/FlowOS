/**
 * FlowOS mobile - src/screens/auth/LoginScreen.tsx
 */
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, Button, HelperText, Avatar } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Screen from '../../components/Screen';
import { useAuth } from '../../auth/AuthContext';
import { apiErrorMessage, apiErrorCode, apiErrorDevCode } from '../../api/client';
import { theme, spacing } from '../../theme';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      // Unverified accounts: the backend just re-sent a code — send them to verify.
      if (apiErrorCode(err) === 'EMAIL_NOT_VERIFIED') {
        navigation.navigate('VerifyEmail', { email: email.trim(), devCode: apiErrorDevCode(err) });
        return;
      }
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Avatar.Icon size={80} icon="ticket-confirmation" color="#FFFFFF" style={styles.logo} />
        <Text variant="displaySmall" style={styles.brand}>
          FlowOS
        </Text>
        <Text variant="bodyMedium">Skip the line. Join queues from anywhere.</Text>
      </View>

      <TextInput
        label="Email"
        mode="outlined"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        label="Password"
        mode="outlined"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error && <HelperText type="error">{error}</HelperText>}

      <Button mode="contained" loading={loading} disabled={loading} onPress={onSubmit}>
        Log in
      </Button>
      <Button onPress={() => navigation.navigate('ForgotPassword')}>Forgot password?</Button>
      <Button onPress={() => navigation.navigate('Register')}>
        Don&apos;t have an account? Sign up
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginBottom: spacing.lg, marginTop: spacing.xl, gap: spacing.xs },
  logo: { backgroundColor: theme.colors.primary, marginBottom: spacing.sm },
  brand: { fontWeight: '800' },
});
