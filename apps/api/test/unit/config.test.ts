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

  // AUTH_MODE validation
  it('throws for invalid AUTH_MODE', () => {
    process.env.AUTH_MODE = 'cogntio';

    expect(() => loadConfig()).toThrow("Invalid AUTH_MODE 'cogntio'");
  });

  it('accepts AUTH_MODE=local without Cognito vars', () => {
    process.env.AUTH_MODE = 'local';
    delete process.env.COGNITO_USER_POOL_ID;
    delete process.env.COGNITO_CLIENT_ID;
    delete process.env.COGNITO_REGION;

    const config = loadConfig();
    expect(config.AUTH_MODE).toBe('local');
    expect(config.COGNITO_USER_POOL_ID).toBe('');
    expect(config.COGNITO_CLIENT_ID).toBe('');
    expect(config.COGNITO_REGION).toBe('');
  });

  it('requires COGNITO_USER_POOL_ID when AUTH_MODE=cognito', () => {
    process.env.AUTH_MODE = 'cognito';
    delete process.env.COGNITO_USER_POOL_ID;
    process.env.COGNITO_CLIENT_ID = 'some-client-id';
    process.env.COGNITO_REGION = 'us-east-1';

    expect(() => loadConfig()).toThrow('COGNITO_USER_POOL_ID');
  });

  it('requires COGNITO_CLIENT_ID when AUTH_MODE=cognito', () => {
    process.env.AUTH_MODE = 'cognito';
    process.env.COGNITO_USER_POOL_ID = 'us-east-1_abc123';
    delete process.env.COGNITO_CLIENT_ID;
    process.env.COGNITO_REGION = 'us-east-1';

    expect(() => loadConfig()).toThrow('COGNITO_CLIENT_ID');
  });

  it('requires COGNITO_REGION when AUTH_MODE=cognito', () => {
    process.env.AUTH_MODE = 'cognito';
    process.env.COGNITO_USER_POOL_ID = 'us-east-1_abc123';
    process.env.COGNITO_CLIENT_ID = 'some-client-id';
    delete process.env.COGNITO_REGION;

    expect(() => loadConfig()).toThrow('COGNITO_REGION');
  });

  it('accepts all Cognito vars when AUTH_MODE=cognito', () => {
    process.env.AUTH_MODE = 'cognito';
    process.env.COGNITO_USER_POOL_ID = 'us-east-1_abc123';
    process.env.COGNITO_CLIENT_ID = 'some-client-id';
    process.env.COGNITO_REGION = 'us-east-1';

    const config = loadConfig();
    expect(config.AUTH_MODE).toBe('cognito');
    expect(config.COGNITO_USER_POOL_ID).toBe('us-east-1_abc123');
    expect(config.COGNITO_CLIENT_ID).toBe('some-client-id');
    expect(config.COGNITO_REGION).toBe('us-east-1');
  });
});
