/**
 * FlowOS mobile - src/storage/tokens.ts
 * Secure token persistence via the native Keychain/Keystore.
 */
import * as Keychain from 'react-native-keychain';

const SERVICE = 'com.flowos.tokens';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await Keychain.setGenericPassword('flowos', JSON.stringify(tokens), { service: SERVICE });
}

export async function loadTokens(): Promise<StoredTokens | null> {
  const creds = await Keychain.getGenericPassword({ service: SERVICE });
  if (!creds) return null;
  try {
    return JSON.parse(creds.password) as StoredTokens;
  } catch {
    return null;
  }
}

export async function clearTokens(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE });
}
