/**
 * FlowOS mobile - src/screens/auth/RegisterScreen.tsx
 */
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, Button, HelperText, SegmentedButtons } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Screen from '../../components/Screen';
import { useAuth } from '../../auth/AuthContext';
import { apiErrorMessage } from '../../api/client';
import { spacing } from '../../theme';
import type { AuthStackParamList } from '../../navigation/types';
import type { Role } from '../../api/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('CUSTOMER');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      const trimmedEmail = email.trim();
      const { devCode } = await register({ name: name.trim(), email: trimmedEmail, password, role });
      // Account created + code emailed — go verify before the session starts.
      // devCode is only present from a demo backend (surfaces the code in-app).
      navigation.navigate('VerifyEmail', { email: trimmedEmail, devCode });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.bold}>
          Create your account
        </Text>
      </View>

      <TextInput label="Full name" mode="outlined" value={name} onChangeText={setName} />
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

      <Text variant="labelLarge">I am a</Text>
      <SegmentedButtons
        value={role}
        onValueChange={(v) => setRole(v as Role)}
        buttons={[
          { value: 'CUSTOMER', label: 'Customer' },
          { value: 'BUSINESS_OWNER', label: 'Business' },
        ]}
      />

      {error && <HelperText type="error">{error}</HelperText>}

      <Button mode="contained" loading={loading} disabled={loading} onPress={onSubmit}>
        Sign up
      </Button>
      <Button onPress={() => navigation.navigate('Login')}>Already have an account? Log in</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.sm, marginTop: spacing.lg },
  bold: { fontWeight: '800' },
});
