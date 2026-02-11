import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { CognitoUser, CognitoUserSession } from 'amazon-cognito-identity-js';
import { getAuthMode, getCognitoConfig } from './auth-config';
import { SessionCognitoStorage } from './cognito-storage';
import { CognitoAuthClient } from './cognito-client';
import { apiClient, setAuthProvider, clearAuthProvider } from '@/lib/api-client';
import type { LoginAccount } from '@/lib/api-client';

export type { LoginAccount };

export interface AuthUser {
  tenantId: string;
  userId: string;
  fullName: string;
  role: string;
  tenantName: string;
}

export interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  error: string | null;
  pendingNewPassword: boolean;

  lookupEmail: (email: string) => Promise<LoginAccount[]>;
  selectAccount: (account: LoginAccount) => boolean;
  authenticate: (password: string) => Promise<{ newPasswordRequired: boolean }>;
  handleNewPassword: (newPassword: string) => Promise<void>;
  getAccessToken: () => Promise<string>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_REFRESH_BUFFER_SECONDS = 5 * 60; // Refresh if <5min remaining

interface PendingChallenge {
  cognitoUser: CognitoUser;
  requiredAttributes: unknown;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const mode = getAuthMode();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingNewPassword, setPendingNewPassword] = useState(false);

  // Refs for cognito-mode mutable state (no re-render needed)
  const cognitoClientRef = useRef<CognitoAuthClient | null>(null);
  const pendingChallengeRef = useRef<PendingChallenge | null>(null);
  const selectedAccountRef = useRef<LoginAccount | null>(null);
  const currentSessionRef = useRef<CognitoUserSession | null>(null);

  // Initialize on mount
  useEffect(() => {
    if (mode === 'local') {
      // Local mode: check localStorage
      const tenantId = localStorage.getItem('dev_tenant_id');
      const userId = localStorage.getItem('dev_user_id');
      if (tenantId && userId) {
        setIsAuthenticated(true);
        setUser({ tenantId, userId, fullName: '', role: '', tenantName: '' });
      }
      setIsLoading(false);
    } else {
      // Cognito mode: create client + check existing session
      const config = getCognitoConfig();
      const storage = new SessionCognitoStorage();
      const client = new CognitoAuthClient(config.userPoolId, config.clientId, storage);
      cognitoClientRef.current = client;

      client
        .getSession()
        .then((session) => {
          if (session && session.isValid()) {
            currentSessionRef.current = session;
            // Recover user from stored account info
            const storedUser = sessionStorage.getItem('seedling_auth_user');
            if (storedUser) {
              try {
                const parsed = JSON.parse(storedUser) as AuthUser;
                setUser(parsed);
                setIsAuthenticated(true);
                registerCognitoProvider(client);
              } catch {
                // Corrupt stored user — treat as not authenticated
                client.signOut();
              }
            } else {
              // Have session but no user info — force re-login
              client.signOut();
            }
          }
        })
        .catch(() => {
          // Session check failed — not authenticated
        })
        .finally(() => {
          setIsLoading(false);
        });
    }

    return () => {
      if (mode === 'cognito') {
        clearAuthProvider();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function registerCognitoProvider(client: CognitoAuthClient) {
    setAuthProvider({
      getToken: async () => {
        const session = currentSessionRef.current;
        if (!session) throw new Error('No session');
        // Check if token needs refresh
        const accessToken = session.getAccessToken();
        const exp = accessToken.getExpiration();
        const now = Math.floor(Date.now() / 1000);
        if (exp - now < TOKEN_REFRESH_BUFFER_SECONDS) {
          const newSession = await client.refreshSession();
          if (!newSession) throw new Error('Refresh failed');
          currentSessionRef.current = newSession;
          return newSession.getAccessToken().getJwtToken();
        }
        return accessToken.getJwtToken();
      },
      forceRefresh: async () => {
        const newSession = await client.refreshSession();
        if (!newSession) throw new Error('Refresh failed');
        currentSessionRef.current = newSession;
        return newSession.getAccessToken().getJwtToken();
      },
      onAuthFailure: async () => {
        clearAuthProvider();
        cognitoClientRef.current?.signOut();
        sessionStorage.removeItem('seedling_auth_user');
        currentSessionRef.current = null;
        selectedAccountRef.current = null;
        pendingChallengeRef.current = null;
        queryClient.clear();
        setUser(null);
        setIsAuthenticated(false);
        setPendingNewPassword(false);
        setError(null);
      },
    });
  }

  const lookupEmail = useCallback(
    async (email: string): Promise<LoginAccount[]> => {
      setError(null);
      try {
        if (mode === 'local') {
          const result = await apiClient.localLogin(email);
          return result.accounts;
        } else {
          const result = await apiClient.cognitoLookup(email);
          return result.accounts;
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Something went wrong. Please try again.';
        setError(msg);
        throw err;
      }
    },
    [mode],
  );

  const selectAccount = useCallback(
    (account: LoginAccount): boolean => {
      setError(null);
      selectedAccountRef.current = account;
      // Always require password step (mirrors cognito flow in local mode too)
      return false;
    },
    [],
  );

  const authenticate = useCallback(
    async (password: string): Promise<{ newPasswordRequired: boolean }> => {
      setError(null);
      const account = selectedAccountRef.current;
      if (!account) {
        setError('No account selected');
        return { newPasswordRequired: false };
      }

      if (mode === 'local') {
        // Local mode: accept any password, set localStorage
        localStorage.setItem('dev_tenant_id', account.tenantId);
        localStorage.setItem('dev_user_id', account.userId);
        const authUser: AuthUser = {
          tenantId: account.tenantId,
          userId: account.userId,
          fullName: account.fullName,
          role: account.role,
          tenantName: account.tenantName,
        };
        setUser(authUser);
        setIsAuthenticated(true);
        return { newPasswordRequired: false };
      }

      const client = cognitoClientRef.current;
      if (!client) {
        setError('Auth client not initialized');
        return { newPasswordRequired: false };
      }

      try {
        const result = await client.signIn(account.userId, password);

        if (result.type === 'newPasswordRequired') {
          pendingChallengeRef.current = {
            cognitoUser: result.cognitoUser,
            requiredAttributes: result.requiredAttributes,
          };
          setPendingNewPassword(true);
          return { newPasswordRequired: true };
        }

        // Success
        currentSessionRef.current = result.session;
        const authUser: AuthUser = {
          tenantId: account.tenantId,
          userId: account.userId,
          fullName: account.fullName,
          role: account.role,
          tenantName: account.tenantName,
        };
        sessionStorage.setItem('seedling_auth_user', JSON.stringify(authUser));
        setUser(authUser);
        setIsAuthenticated(true);
        registerCognitoProvider(client);
        return { newPasswordRequired: false };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Authentication failed';
        setError(msg);
        throw err;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode],
  );

  const handleNewPassword = useCallback(
    async (newPassword: string): Promise<void> => {
      setError(null);
      const challenge = pendingChallengeRef.current;
      const account = selectedAccountRef.current;
      const client = cognitoClientRef.current;

      if (!challenge || !account || !client) {
        setError('No pending password challenge');
        return;
      }

      try {
        const session = await client.completeNewPassword(
          challenge.cognitoUser,
          newPassword,
          challenge.requiredAttributes,
        );

        currentSessionRef.current = session;
        pendingChallengeRef.current = null;
        const authUser: AuthUser = {
          tenantId: account.tenantId,
          userId: account.userId,
          fullName: account.fullName,
          role: account.role,
          tenantName: account.tenantName,
        };
        sessionStorage.setItem('seedling_auth_user', JSON.stringify(authUser));
        setUser(authUser);
        setIsAuthenticated(true);
        setPendingNewPassword(false);
        registerCognitoProvider(client);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to set new password';
        setError(msg);
        throw err;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const getAccessToken = useCallback(async (): Promise<string> => {
    if (mode === 'local') return '';

    const session = currentSessionRef.current;
    if (!session) return '';

    const accessToken = session.getAccessToken();
    const exp = accessToken.getExpiration();
    const now = Math.floor(Date.now() / 1000);

    if (exp - now < TOKEN_REFRESH_BUFFER_SECONDS) {
      const client = cognitoClientRef.current;
      if (!client) return '';
      const newSession = await client.refreshSession();
      if (!newSession) throw new Error('Token refresh failed');
      currentSessionRef.current = newSession;
      return newSession.getAccessToken().getJwtToken();
    }

    return accessToken.getJwtToken();
  }, [mode]);

  const logout = useCallback(async (): Promise<void> => {
    if (mode === 'local') {
      localStorage.removeItem('dev_tenant_id');
      localStorage.removeItem('dev_user_id');
    } else {
      clearAuthProvider();
      cognitoClientRef.current?.signOut();
      sessionStorage.removeItem('seedling_auth_user');
      currentSessionRef.current = null;
      selectedAccountRef.current = null;
      pendingChallengeRef.current = null;
    }

    queryClient.clear();
    setUser(null);
    setIsAuthenticated(false);
    setPendingNewPassword(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, queryClient]);

  const value: AuthContextValue = {
    isAuthenticated,
    isLoading,
    user,
    error,
    pendingNewPassword,
    lookupEmail,
    selectAccount,
    authenticate,
    handleNewPassword,
    getAccessToken,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
