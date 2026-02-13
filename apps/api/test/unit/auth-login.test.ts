import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/app.js';
import type { AppConfig } from '../../src/shared/config.js';
import type { JwtVerifier } from '../../src/application/ports/jwt-verifier.js';

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    API_PORT: 0,
    NODE_ENV: 'test',
    AUTH_MODE: 'local',
    DEV_AUTH_TENANT_ID: '',
    DEV_AUTH_USER_ID: '',
    DEV_AUTH_ROLE: '',
    NOTIFICATION_ENABLED: false,
    SMTP_HOST: 'localhost',
    SMTP_PORT: 1025,
    SMTP_FROM: 'test@seedling.local',
    APP_BASE_URL: 'http://localhost:5173',
    SECURE_LINK_HMAC_SECRET: 'test-secret-for-unit',
    COGNITO_USER_POOL_ID: '',
    COGNITO_CLIENT_ID: '',
    COGNITO_REGION: '',
    S3_BUCKET: 'test-bucket',
    S3_REGION: 'us-east-1',
    S3_ENDPOINT: 'http://localhost:4566',
    ...overrides,
  };
}

// In-memory mock database that supports the minimum needed for route registration
function makeMockDb() {
  return {} as any;
}

describe('POST /v1/auth/local/login', () => {
  it('returns 404 when AUTH_MODE is cognito', async () => {
    const config = makeConfig({
      AUTH_MODE: 'cognito',
      COGNITO_USER_POOL_ID: 'us-east-1_TestPool',
      COGNITO_CLIENT_ID: 'test-client',
      COGNITO_REGION: 'us-east-1',
    });
    // No-op verifier — this test only checks that the login endpoint returns 404
    const jwtVerifier: JwtVerifier = { verify: async () => { throw new Error('not used'); } };
    const app = await createApp({ config, db: makeMockDb(), jwtVerifier });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/local/login',
      payload: { email: 'test@example.com' },
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 for invalid email format', async () => {
    const config = makeConfig();
    const app = await createApp({ config, db: makeMockDb() });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/local/login',
      payload: { email: 'not-an-email' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when email is missing', async () => {
    const config = makeConfig();
    const app = await createApp({ config, db: makeMockDb() });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/local/login',
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });
});
