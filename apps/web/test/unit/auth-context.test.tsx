import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// Mock auth-config before importing auth-context
let mockMode = 'local';
vi.mock('@/lib/auth/auth-config', () => ({
  getAuthMode: () => mockMode,
  isLocalMode: () => mockMode === 'local',
  isCognitoMode: () => mockMode === 'cognito',
  getCognitoConfig: () => ({ userPoolId: 'us-east-1_Test', clientId: 'test-client' }),
}));

// Mock CognitoAuthClient
const mockSignIn = vi.fn();
const mockCompleteNewPassword = vi.fn();
const mockRefreshSession = vi.fn();
const mockGetSession = vi.fn();
const mockSignOut = vi.fn();

vi.mock('@/lib/auth/cognito-client', () => ({
  CognitoAuthClient: vi.fn().mockImplementation(() => ({
    signIn: mockSignIn,
    completeNewPassword: mockCompleteNewPassword,
    refreshSession: mockRefreshSession,
    getSession: mockGetSession,
    signOut: mockSignOut,
    getCurrentUser: vi.fn().mockReturnValue(null),
  })),
}));

// Mock cognito-storage
vi.mock('@/lib/auth/cognito-storage', () => ({
  SessionCognitoStorage: vi.fn(),
}));

// Mock api-client
const mockLocalLogin = vi.fn();
const mockCognitoLookup = vi.fn();
const mockSetAuthProvider = vi.fn();
const mockClearAuthProvider = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    localLogin: (...args: any[]) => mockLocalLogin(...args),
    cognitoLookup: (...args: any[]) => mockCognitoLookup(...args),
  },
  setAuthProvider: (...args: any[]) => mockSetAuthProvider(...args),
  clearAuthProvider: (...args: any[]) => mockClearAuthProvider(...args),
}));

import { AuthProvider, useAuth } from '@/lib/auth/auth-context';

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
  };
}

describe('AuthProvider (local mode)', () => {
  beforeEach(() => {
    mockMode = 'local';
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('starts with isLoading true then becomes false', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });

    // After initial render + useEffect
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('isAuthenticated reflects localStorage', async () => {
    localStorage.setItem('dev_tenant_id', 'tenant-1');
    localStorage.setItem('dev_user_id', 'user-1');

    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.tenantId).toBe('tenant-1');
    expect(result.current.user?.userId).toBe('user-1');
  });

  it('isAuthenticated false when localStorage empty', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('lookupEmail calls localLogin', async () => {
    mockLocalLogin.mockResolvedValue({
      accounts: [{ tenantId: 't1', tenantName: 'Biz', userId: 'u1', fullName: 'Owner', role: 'owner' }],
    });

    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let accounts: any[];
    await act(async () => {
      accounts = await result.current.lookupEmail('test@test.com');
    });
    expect(accounts!).toHaveLength(1);
    expect(mockLocalLogin).toHaveBeenCalledWith('test@test.com');
  });

  it('selectAccount sets localStorage and returns true (auth complete)', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let done: boolean;
    act(() => {
      done = result.current.selectAccount({
        tenantId: 't1', tenantName: 'Biz', userId: 'u1', fullName: 'Owner', role: 'owner',
      });
    });

    expect(done!).toBe(true);
    expect(localStorage.getItem('dev_tenant_id')).toBe('t1');
    expect(localStorage.getItem('dev_user_id')).toBe('u1');
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('logout clears localStorage and query cache', async () => {
    localStorage.setItem('dev_tenant_id', 't1');
    localStorage.setItem('dev_user_id', 'u1');

    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(true);

    await act(async () => {
      await result.current.logout();
    });

    expect(localStorage.getItem('dev_tenant_id')).toBeNull();
    expect(localStorage.getItem('dev_user_id')).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('getAccessToken returns empty string in local mode', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let token: string;
    await act(async () => {
      token = await result.current.getAccessToken();
    });
    expect(token!).toBe('');
  });
});

describe('AuthProvider (cognito mode)', () => {
  beforeEach(() => {
    mockMode = 'cognito';
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mockGetSession.mockResolvedValue(null);
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('starts unauthenticated when no session', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
  });

  it('lookupEmail calls cognitoLookup', async () => {
    mockCognitoLookup.mockResolvedValue({
      accounts: [{ tenantId: 't1', tenantName: 'Biz', userId: 'u1', fullName: 'Owner', role: 'owner' }],
    });

    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let accounts: any[];
    await act(async () => {
      accounts = await result.current.lookupEmail('test@test.com');
    });
    expect(accounts!).toHaveLength(1);
    expect(mockCognitoLookup).toHaveBeenCalledWith('test@test.com');
  });

  it('selectAccount returns false (password needed)', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let done: boolean;
    act(() => {
      done = result.current.selectAccount({
        tenantId: 't1', tenantName: 'Biz', userId: 'u1', fullName: 'Owner', role: 'owner',
      });
    });

    expect(done!).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('authenticate calls signIn and sets authenticated', async () => {
    const mockSession = {
      getAccessToken: () => ({
        getJwtToken: () => 'access-token',
        getExpiration: () => Math.floor(Date.now() / 1000) + 3600,
      }),
    };
    mockSignIn.mockResolvedValue({ type: 'success', session: mockSession });

    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.selectAccount({
        tenantId: 't1', tenantName: 'Biz', userId: 'u1', fullName: 'Owner', role: 'owner',
      });
    });

    let authResult: any;
    await act(async () => {
      authResult = await result.current.authenticate('password');
    });

    expect(authResult.newPasswordRequired).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
    expect(mockSignIn).toHaveBeenCalledWith('u1', 'password');
    expect(mockSetAuthProvider).toHaveBeenCalled();
  });

  it('authenticate returns newPasswordRequired when challenge received', async () => {
    const mockCognitoUser = {};
    mockSignIn.mockResolvedValue({
      type: 'newPasswordRequired',
      cognitoUser: mockCognitoUser,
      requiredAttributes: { email: 'test@test.com' },
    });

    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.selectAccount({
        tenantId: 't1', tenantName: 'Biz', userId: 'u1', fullName: 'Owner', role: 'owner',
      });
    });

    let authResult: any;
    await act(async () => {
      authResult = await result.current.authenticate('temp-pass');
    });

    expect(authResult.newPasswordRequired).toBe(true);
    expect(result.current.pendingNewPassword).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('handleNewPassword completes challenge and authenticates', async () => {
    const mockCognitoUser = {};
    const requiredAttrs = { email: 'test@test.com' };
    mockSignIn.mockResolvedValue({
      type: 'newPasswordRequired',
      cognitoUser: mockCognitoUser,
      requiredAttributes: requiredAttrs,
    });

    const mockSession = {
      getAccessToken: () => ({
        getJwtToken: () => 'new-token',
        getExpiration: () => Math.floor(Date.now() / 1000) + 3600,
      }),
    };
    mockCompleteNewPassword.mockResolvedValue(mockSession);

    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.selectAccount({
        tenantId: 't1', tenantName: 'Biz', userId: 'u1', fullName: 'Owner', role: 'owner',
      });
    });

    await act(async () => {
      await result.current.authenticate('temp');
    });

    await act(async () => {
      await result.current.handleNewPassword('new-password-123');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.pendingNewPassword).toBe(false);
    expect(mockCompleteNewPassword).toHaveBeenCalledWith(
      mockCognitoUser,
      'new-password-123',
      requiredAttrs,
    );
  });

  it('logout calls signOut and clears state', async () => {
    const mockSession = {
      getAccessToken: () => ({
        getJwtToken: () => 'token',
        getExpiration: () => Math.floor(Date.now() / 1000) + 3600,
      }),
    };
    mockSignIn.mockResolvedValue({ type: 'success', session: mockSession });

    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.selectAccount({
        tenantId: 't1', tenantName: 'Biz', userId: 'u1', fullName: 'Owner', role: 'owner',
      });
    });

    await act(async () => {
      await result.current.authenticate('pass');
    });
    expect(result.current.isAuthenticated).toBe(true);

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockClearAuthProvider).toHaveBeenCalled();
  });

  it('session recovery on mount with stored user', async () => {
    const mockSession = {
      isValid: () => true,
      getAccessToken: () => ({
        getJwtToken: () => 'recovered-token',
        getExpiration: () => Math.floor(Date.now() / 1000) + 3600,
      }),
    };
    mockGetSession.mockResolvedValue(mockSession);
    sessionStorage.setItem('seedling_auth_user', JSON.stringify({
      tenantId: 't1', userId: 'u1', fullName: 'Owner', role: 'owner', tenantName: 'Biz',
    }));

    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.tenantId).toBe('t1');
    expect(mockSetAuthProvider).toHaveBeenCalled();
  });
});
