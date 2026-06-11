/**
 * FlowOS mobile - src/auth/AuthContext.tsx
 * Holds the auth session. Loads persisted tokens on launch, exposes login/register/
 * logout, and keeps the in-memory api client tokens + Keychain in sync.
 */
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { authApi } from '../api/endpoints';
import { setAuthTokens, registerAuthCallbacks, isNetworkError } from '../api/client';
import { saveTokens, loadTokens, clearTokens } from '../storage/tokens';
import { connectSocket, disconnectSocket } from '../realtime/socket';
import { registerDeviceToken, unregisterDeviceToken } from '../push/deviceToken';
import { onRecovered } from '../net/connectivity';
import type { Role, User } from '../api/types';

interface AuthContextValue {
  user: User | null;
  initializing: boolean;
  /**
   * Set when restoring a saved session failed because the backend was unreachable
   * (NOT because the session is invalid). The UI shows a retry screen instead of
   * silently logging the user out; recovery is also attempted automatically.
   */
  bootError: 'network' | null;
  /** Re-attempt session restore (used by the connection-error retry button). */
  retryRestore: () => void;
  login: (email: string, password: string) => Promise<void>;
  /**
   * Creates the account and triggers a verification email. Does NOT start a session.
   * In a non-production (demo) backend the response includes `devCode` so the UI can
   * surface the code without an inbox.
   */
  register: (input: {
    name: string;
    email: string;
    password: string;
    role: Role;
  }) => Promise<{ devCode?: string }>;
  /** Confirm the emailed OTP; on success the user is signed in. */
  verifyEmail: (email: string, otp: string) => Promise<void>;
  /** Re-send a code; returns the demo `devCode` when the backend exposes it. */
  resendOtp: (email: string) => Promise<{ devCode?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [refreshTokenValue, setRefreshTokenValue] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [bootError, setBootError] = useState<'network' | null>(null);

  const persist = useCallback(async (access: string, refresh: string) => {
    setAuthTokens(access, refresh);
    setRefreshTokenValue(refresh);
    await saveTokens({ accessToken: access, refreshToken: refresh });
  }, []);

  const clearSession = useCallback(async () => {
    await unregisterDeviceToken().catch(() => undefined);
    disconnectSocket();
    setAuthTokens(null, null);
    setUser(null);
    setRefreshTokenValue(null);
    await clearTokens();
  }, []);

  // Open the realtime connection + register this device for push whenever we have
  // an authenticated user. Device registration is gated by the user's push setting.
  useEffect(() => {
    if (user) {
      connectSocket();
      void registerDeviceToken({ pushEnabled: user.settings.pushEnabled }).catch(() => undefined);
    }
  }, [user]);

  // Wire client callbacks (silent refresh + forced logout) once.
  useEffect(() => {
    registerAuthCallbacks({
      onTokensRefreshed: (access, refresh) => {
        setRefreshTokenValue(refresh);
        void saveTokens({ accessToken: access, refreshToken: refresh });
      },
      onLogout: () => {
        void clearSession();
      },
    });
  }, [clearSession]);

  // Restore a session on cold start.
  //   - Network failure (backend cold/unreachable): KEEP the saved tokens and flag
  //     a recoverable boot error. We do NOT log the user out for a transient blip
  //     (that was the bug that forced a manual refresh / re-login).
  //   - Auth failure (token genuinely invalid): clear the session.
  const restore = useCallback(async () => {
    setBootError(null);
    setInitializing(true);
    try {
      const tokens = await loadTokens();
      if (!tokens) {
        return;
      }
      setAuthTokens(tokens.accessToken, tokens.refreshToken);
      setRefreshTokenValue(tokens.refreshToken);
      const me = await authApi.me(); // axios client already retries transient failures
      setUser(me);
    } catch (err) {
      if (isNetworkError(err)) {
        setBootError('network'); // keep tokens; allow retry / auto-recovery
      } else {
        await clearSession();
      }
    } finally {
      setInitializing(false);
    }
  }, [clearSession]);

  useEffect(() => {
    void restore();
  }, [restore]);

  // Auto-recover: if the backend comes back while we're stuck on a boot network
  // error, retry the restore without the user lifting a finger.
  useEffect(() => {
    return onRecovered(() => {
      if (!user && bootError === 'network') void restore();
    });
  }, [user, bootError, restore]);

  const retryRestore = useCallback(() => {
    void restore();
  }, [restore]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await authApi.login({ email, password });
      await persist(res.accessToken, res.refreshToken);
      setUser(res.user);
    },
    [persist],
  );

  const register = useCallback(
    async (input: { name: string; email: string; password: string; role: Role }) => {
      // Registration only creates the account + sends a code; verification logs in.
      const res = await authApi.register(input);
      return { devCode: res.devCode };
    },
    [],
  );

  const verifyEmail = useCallback(
    async (email: string, otp: string) => {
      const res = await authApi.verifyEmail({ email, otp });
      await persist(res.accessToken, res.refreshToken);
      setUser(res.user);
    },
    [persist],
  );

  const resendOtp = useCallback(async (email: string) => {
    const res = await authApi.resendOtp(email);
    return { devCode: res.devCode };
  }, []);

  const logout = useCallback(async () => {
    try {
      if (refreshTokenValue) await authApi.logout(refreshTokenValue);
    } catch {
      // ignore network errors on logout
    }
    await clearSession();
  }, [refreshTokenValue, clearSession]);

  const value = useMemo(
    () => ({
      user,
      initializing,
      bootError,
      retryRestore,
      login,
      register,
      verifyEmail,
      resendOtp,
      logout,
    }),
    [user, initializing, bootError, retryRestore, login, register, verifyEmail, resendOtp, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
