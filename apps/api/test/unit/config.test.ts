import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../../src/shared/config.js';

describe('loadConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Set minimum required env vars
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('uses default HMAC secret in development', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.SECURE_LINK_HMAC_SECRET;

    const config = loadConfig();
    expect(config.SECURE_LINK_HMAC_SECRET).toBe('dev-secret-change-in-production');
  });

  it('throws when SECURE_LINK_HMAC_SECRET is missing in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SECURE_LINK_HMAC_SECRET;

    expect(() => loadConfig()).toThrow('SECURE_LINK_HMAC_SECRET');
  });

  it('throws when SECURE_LINK_HMAC_SECRET is the default dev value in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.SECURE_LINK_HMAC_SECRET = 'dev-secret-change-in-production';

    expect(() => loadConfig()).toThrow('SECURE_LINK_HMAC_SECRET');
  });

  it('accepts a custom HMAC secret in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.SECURE_LINK_HMAC_SECRET = 'my-production-secret-at-least-32-chars';

    const config = loadConfig();
    expect(config.SECURE_LINK_HMAC_SECRET).toBe('my-production-secret-at-least-32-chars');
  });

  it('throws when SECURE_LINK_HMAC_SECRET is too short in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.SECURE_LINK_HMAC_SECRET = 'short';

    expect(() => loadConfig()).toThrow('SECURE_LINK_HMAC_SECRET');
  });
});
