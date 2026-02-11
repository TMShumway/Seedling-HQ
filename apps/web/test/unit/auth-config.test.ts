import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need to mock import.meta.env which is set by Vite.
// In vitest with jsdom, import.meta.env is available but we control values via vi.stubEnv.

describe('auth-config', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    // Reset module cache so each test gets fresh reads of import.meta.env
    vi.resetModules();
  });

  describe('getAuthMode', () => {
    it('defaults to local when VITE_AUTH_MODE is not set', async () => {
      vi.stubEnv('VITE_AUTH_MODE', '');
      const { getAuthMode } = await import('@/lib/auth/auth-config');
      expect(getAuthMode()).toBe('local');
    });

    it('returns local when VITE_AUTH_MODE is local', async () => {
      vi.stubEnv('VITE_AUTH_MODE', 'local');
      const { getAuthMode } = await import('@/lib/auth/auth-config');
      expect(getAuthMode()).toBe('local');
    });

    it('returns cognito when VITE_AUTH_MODE is cognito', async () => {
      vi.stubEnv('VITE_AUTH_MODE', 'cognito');
      const { getAuthMode } = await import('@/lib/auth/auth-config');
      expect(getAuthMode()).toBe('cognito');
    });

    it('throws for invalid mode', async () => {
      vi.stubEnv('VITE_AUTH_MODE', 'invalid');
      const { getAuthMode } = await import('@/lib/auth/auth-config');
      expect(() => getAuthMode()).toThrow('Invalid VITE_AUTH_MODE: "invalid"');
    });
  });

  describe('isLocalMode / isCognitoMode', () => {
    it('isLocalMode returns true when local', async () => {
      vi.stubEnv('VITE_AUTH_MODE', 'local');
      const { isLocalMode, isCognitoMode } = await import('@/lib/auth/auth-config');
      expect(isLocalMode()).toBe(true);
      expect(isCognitoMode()).toBe(false);
    });

    it('isCognitoMode returns true when cognito', async () => {
      vi.stubEnv('VITE_AUTH_MODE', 'cognito');
      const { isLocalMode, isCognitoMode } = await import('@/lib/auth/auth-config');
      expect(isLocalMode()).toBe(false);
      expect(isCognitoMode()).toBe(true);
    });
  });

  describe('getCognitoConfig', () => {
    it('returns config when both vars are set', async () => {
      vi.stubEnv('VITE_AUTH_MODE', 'cognito');
      vi.stubEnv('VITE_COGNITO_USER_POOL_ID', 'us-east-1_TestPool');
      vi.stubEnv('VITE_COGNITO_CLIENT_ID', 'test-client-id');
      const { getCognitoConfig } = await import('@/lib/auth/auth-config');
      expect(getCognitoConfig()).toEqual({
        userPoolId: 'us-east-1_TestPool',
        clientId: 'test-client-id',
      });
    });

    it('throws when VITE_COGNITO_USER_POOL_ID is missing', async () => {
      vi.stubEnv('VITE_AUTH_MODE', 'cognito');
      vi.stubEnv('VITE_COGNITO_USER_POOL_ID', '');
      vi.stubEnv('VITE_COGNITO_CLIENT_ID', 'test-client-id');
      const { getCognitoConfig } = await import('@/lib/auth/auth-config');
      expect(() => getCognitoConfig()).toThrow('VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_CLIENT_ID must be set');
    });

    it('throws when VITE_COGNITO_CLIENT_ID is missing', async () => {
      vi.stubEnv('VITE_AUTH_MODE', 'cognito');
      vi.stubEnv('VITE_COGNITO_USER_POOL_ID', 'us-east-1_TestPool');
      vi.stubEnv('VITE_COGNITO_CLIENT_ID', '');
      const { getCognitoConfig } = await import('@/lib/auth/auth-config');
      expect(() => getCognitoConfig()).toThrow('VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_CLIENT_ID must be set');
    });
  });
});
