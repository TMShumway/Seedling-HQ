import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CognitoAuthClient } from '@/lib/auth/cognito-client';

// Mock the entire amazon-cognito-identity-js module
vi.mock('amazon-cognito-identity-js', () => {
  const mockSignOut = vi.fn();
  const mockGetSession = vi.fn();
  const mockRefreshSession = vi.fn();
  const mockAuthenticateUser = vi.fn();
  const mockCompleteNewPasswordChallenge = vi.fn();
  const mockSetAuthenticationFlowType = vi.fn();
  const mockGetCurrentUser = vi.fn();

  class MockCognitoUser {
    signOut = mockSignOut;
    getSession = mockGetSession;
    refreshSession = mockRefreshSession;
    authenticateUser = mockAuthenticateUser;
    completeNewPasswordChallenge = mockCompleteNewPasswordChallenge;
    setAuthenticationFlowType = mockSetAuthenticationFlowType;
  }

  class MockCognitoUserPool {
    getCurrentUser = mockGetCurrentUser;
  }

  class MockAuthenticationDetails {}

  class MockCognitoRefreshToken {
    constructor(public data: { RefreshToken: string }) {}
  }

  return {
    CognitoUser: MockCognitoUser,
    CognitoUserPool: MockCognitoUserPool,
    AuthenticationDetails: MockAuthenticationDetails,
    CognitoRefreshToken: MockCognitoRefreshToken,
    CognitoUserSession: class {},
    // Expose mock functions for test assertions
    __mocks: {
      mockSignOut,
      mockGetSession,
      mockRefreshSession,
      mockAuthenticateUser,
      mockCompleteNewPasswordChallenge,
      mockSetAuthenticationFlowType,
      mockGetCurrentUser,
    },
  };
});

// Import the mocks for assertions
import * as cognitoMod from 'amazon-cognito-identity-js';

const mocks = (cognitoMod as any).__mocks as {
  mockSignOut: ReturnType<typeof vi.fn>;
  mockGetSession: ReturnType<typeof vi.fn>;
  mockRefreshSession: ReturnType<typeof vi.fn>;
  mockAuthenticateUser: ReturnType<typeof vi.fn>;
  mockCompleteNewPasswordChallenge: ReturnType<typeof vi.fn>;
  mockSetAuthenticationFlowType: ReturnType<typeof vi.fn>;
  mockGetCurrentUser: ReturnType<typeof vi.fn>;
};

const mockStorage = {
  setItem: vi.fn().mockReturnValue(''),
  getItem: vi.fn().mockReturnValue(''),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

describe('CognitoAuthClient', () => {
  let client: CognitoAuthClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new CognitoAuthClient('us-east-1_TestPool', 'test-client-id', mockStorage);
  });

  describe('signIn', () => {
    it('sets authenticationFlowType to USER_PASSWORD_AUTH', async () => {
      mocks.mockAuthenticateUser.mockImplementation((_details: any, callbacks: any) => {
        callbacks.onSuccess({ getAccessToken: () => ({ getJwtToken: () => 'token' }) });
      });

      await client.signIn('user-id', 'password');
      expect(mocks.mockSetAuthenticationFlowType).toHaveBeenCalledWith('USER_PASSWORD_AUTH');
    });

    it('resolves with success on valid credentials', async () => {
      const mockSession = { getAccessToken: () => ({ getJwtToken: () => 'access-token' }) };
      mocks.mockAuthenticateUser.mockImplementation((_details: any, callbacks: any) => {
        callbacks.onSuccess(mockSession);
      });

      const result = await client.signIn('user-id', 'password');
      expect(result.type).toBe('success');
      if (result.type === 'success') {
        expect(result.session).toBe(mockSession);
      }
    });

    it('rejects on wrong password', async () => {
      mocks.mockAuthenticateUser.mockImplementation((_details: any, callbacks: any) => {
        callbacks.onFailure(new Error('Incorrect username or password.'));
      });

      await expect(client.signIn('user-id', 'wrong')).rejects.toThrow('Incorrect username or password.');
    });

    it('resolves with newPasswordRequired and captures requiredAttributes', async () => {
      const capturedAttributes = { email: 'user@test.com' };
      mocks.mockAuthenticateUser.mockImplementation((_details: any, callbacks: any) => {
        callbacks.newPasswordRequired({}, capturedAttributes);
      });

      const result = await client.signIn('user-id', 'temp-pass');
      expect(result.type).toBe('newPasswordRequired');
      if (result.type === 'newPasswordRequired') {
        expect(result.requiredAttributes).toBe(capturedAttributes);
        expect(result.cognitoUser).toBeDefined();
      }
    });
  });

  describe('completeNewPassword', () => {
    it('forwards requiredAttributes byte-for-byte to SDK', async () => {
      const requiredAttrs = { email: 'user@test.com' };
      const mockSession = { isValid: () => true };

      // First, get the cognitoUser from a newPasswordRequired callback
      let capturedUser: any;
      mocks.mockAuthenticateUser.mockImplementation((_details: any, callbacks: any) => {
        callbacks.newPasswordRequired({}, requiredAttrs);
      });
      const signInResult = await client.signIn('user-id', 'temp');
      if (signInResult.type === 'newPasswordRequired') {
        capturedUser = signInResult.cognitoUser;
      }

      mocks.mockCompleteNewPasswordChallenge.mockImplementation(
        (_newPassword: string, _attrs: any, callbacks: any) => {
          callbacks.onSuccess(mockSession);
        },
      );

      await client.completeNewPassword(capturedUser, 'new-password', requiredAttrs);
      expect(mocks.mockCompleteNewPasswordChallenge).toHaveBeenCalledWith(
        'new-password',
        requiredAttrs,
        expect.any(Object),
      );
    });

    it('rejects on failure', async () => {
      let capturedUser: any;
      mocks.mockAuthenticateUser.mockImplementation((_details: any, callbacks: any) => {
        callbacks.newPasswordRequired({}, {});
      });
      const result = await client.signIn('user-id', 'temp');
      if (result.type === 'newPasswordRequired') capturedUser = result.cognitoUser;

      mocks.mockCompleteNewPasswordChallenge.mockImplementation(
        (_newPassword: string, _attrs: any, callbacks: any) => {
          callbacks.onFailure(new Error('Password does not meet requirements'));
        },
      );

      await expect(client.completeNewPassword(capturedUser, 'weak', {})).rejects.toThrow(
        'Password does not meet requirements',
      );
    });
  });

  describe('refreshSession', () => {
    it('returns new session on success', async () => {
      const mockCurrentUser = {
        getSession: vi.fn(),
        refreshSession: vi.fn(),
      };
      const mockNewSession = { isValid: () => true };
      const mockRefreshToken = { getToken: () => 'refresh-token' };
      const mockOldSession = { getRefreshToken: () => mockRefreshToken };

      mocks.mockGetCurrentUser.mockReturnValue(mockCurrentUser);
      mockCurrentUser.getSession.mockImplementation((cb: any) => cb(null, mockOldSession));
      mockCurrentUser.refreshSession.mockImplementation((_token: any, cb: any) => cb(null, mockNewSession));

      // Need to use a fresh client that uses getCurrentUser from pool
      const result = await client.refreshSession();
      expect(result).toBe(mockNewSession);
    });

    it('returns null when no current user', async () => {
      mocks.mockGetCurrentUser.mockReturnValue(null);
      const result = await client.refreshSession();
      expect(result).toBeNull();
    });
  });

  describe('getSession', () => {
    it('returns session when valid', async () => {
      const mockCurrentUser = {
        getSession: vi.fn(),
      };
      const mockSession = { isValid: () => true };
      mocks.mockGetCurrentUser.mockReturnValue(mockCurrentUser);
      mockCurrentUser.getSession.mockImplementation((cb: any) => cb(null, mockSession));

      const result = await client.getSession();
      expect(result).toBe(mockSession);
    });

    it('returns null on error', async () => {
      const mockCurrentUser = {
        getSession: vi.fn(),
      };
      mocks.mockGetCurrentUser.mockReturnValue(mockCurrentUser);
      mockCurrentUser.getSession.mockImplementation((cb: any) => cb(new Error('expired'), null));

      const result = await client.getSession();
      expect(result).toBeNull();
    });

    it('returns null when no current user', async () => {
      mocks.mockGetCurrentUser.mockReturnValue(null);
      const result = await client.getSession();
      expect(result).toBeNull();
    });
  });

  describe('signOut', () => {
    it('calls signOut on user and clears storage', () => {
      const mockCurrentUser = { signOut: vi.fn() };
      mocks.mockGetCurrentUser.mockReturnValue(mockCurrentUser);

      client.signOut();
      expect(mockCurrentUser.signOut).toHaveBeenCalled();
      expect(mockStorage.clear).toHaveBeenCalled();
    });

    it('clears storage even when no current user', () => {
      mocks.mockGetCurrentUser.mockReturnValue(null);
      client.signOut();
      expect(mockStorage.clear).toHaveBeenCalled();
    });
  });
});
