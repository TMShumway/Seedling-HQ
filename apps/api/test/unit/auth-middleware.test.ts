import { describe, it, expect } from 'vitest';
import { buildAuthMiddleware } from '../../src/adapters/http/middleware/auth-middleware.js';
import type { AppConfig } from '../../src/shared/config.js';
import type { JwtVerifier } from '../../src/application/ports/jwt-verifier.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    API_PORT: 4000,
    NODE_ENV: 'development',
    AUTH_MODE: 'local',
    DEV_AUTH_TENANT_ID: 'tenant-1',
    DEV_AUTH_USER_ID: 'user-1',
    DEV_AUTH_ROLE: 'owner',
    NOTIFICATION_ENABLED: false,
    SMTP_HOST: 'localhost',
    SMTP_PORT: 1025,
    SMTP_FROM: 'test@seedling.local',
    APP_BASE_URL: 'http://localhost:5173',
    SECURE_LINK_HMAC_SECRET: 'test-secret-for-unit-tests',
    COGNITO_USER_POOL_ID: '',
    COGNITO_CLIENT_ID: '',
    COGNITO_REGION: '',
    S3_BUCKET: 'test-bucket',
    S3_REGION: 'us-east-1',
    S3_ENDPOINT: 'http://localhost:4566',
    SMS_PROVIDER: 'stub' as const,
    SMS_ORIGINATION_IDENTITY: '',
    SQS_ENDPOINT: '',
    SQS_MESSAGE_QUEUE_URL: '',
    WORKER_MODE: 'off' as const,
    ...overrides,
  };
}

function makeRequest(headers: Record<string, string> = {}): FastifyRequest {
  return { authContext: null, headers, log: { warn: () => {} } } as unknown as FastifyRequest;
}

function makeReply(): FastifyReply {
  return {} as FastifyReply;
}

describe('authMiddleware', () => {
  it('injects correct authContext in local mode', async () => {
    const config = makeConfig();
    const middleware = buildAuthMiddleware({ config });
    const request = makeRequest();

    await middleware(request, makeReply());

    expect(request.authContext).toEqual({
      principal_type: 'internal',
      tenant_id: 'tenant-1',
      user_id: 'user-1',
      role: 'owner',
    });
  });

  it('refuses to activate local mode in production', async () => {
    const config = makeConfig({ NODE_ENV: 'production' });
    const middleware = buildAuthMiddleware({ config });
    const request = makeRequest();

    await expect(middleware(request, makeReply())).rejects.toThrow(
      'AUTH_MODE=local is not allowed in production',
    );
  });

  it('uses DEV_AUTH values from config', async () => {
    const config = makeConfig({
      DEV_AUTH_TENANT_ID: 'custom-tenant',
      DEV_AUTH_USER_ID: 'custom-user',
      DEV_AUTH_ROLE: 'admin',
    });
    const middleware = buildAuthMiddleware({ config });
    const request = makeRequest();

    await middleware(request, makeReply());

    expect(request.authContext.tenant_id).toBe('custom-tenant');
    expect(request.authContext.user_id).toBe('custom-user');
    expect(request.authContext.role).toBe('admin');
  });

  it('overrides tenant/user from X-Dev headers in local mode', async () => {
    const config = makeConfig();
    const middleware = buildAuthMiddleware({ config });
    const request = makeRequest({
      'x-dev-tenant-id': 'override-tenant',
      'x-dev-user-id': 'override-user',
    });

    await middleware(request, makeReply());

    expect(request.authContext.tenant_id).toBe('override-tenant');
    expect(request.authContext.user_id).toBe('override-user');
    expect(request.authContext.role).toBe('owner');
  });

  // Cognito mode tests
  it('sets authContext from JWT verifier in cognito mode', async () => {
    const config = makeConfig({ AUTH_MODE: 'cognito' });
    const jwtVerifier: JwtVerifier = {
      verify: async () => ({ tenantId: 'cog-tenant', userId: 'cog-user', role: 'admin' as const }),
    };
    const middleware = buildAuthMiddleware({ config, jwtVerifier });
    const request = makeRequest({ authorization: 'Bearer valid-token' });

    await middleware(request, makeReply());

    expect(request.authContext).toEqual({
      tenant_id: 'cog-tenant',
      user_id: 'cog-user',
      role: 'admin',
      principal_type: 'internal',
    });
  });

  it('throws 401 when Authorization header is missing in cognito mode', async () => {
    const config = makeConfig({ AUTH_MODE: 'cognito' });
    const jwtVerifier: JwtVerifier = {
      verify: async () => ({ tenantId: 't', userId: 'u', role: 'owner' as const }),
    };
    const middleware = buildAuthMiddleware({ config, jwtVerifier });
    const request = makeRequest();

    await expect(middleware(request, makeReply())).rejects.toThrow('Missing or malformed Authorization header');
  });

  it('throws 401 when Authorization header has no Bearer prefix', async () => {
    const config = makeConfig({ AUTH_MODE: 'cognito' });
    const jwtVerifier: JwtVerifier = {
      verify: async () => ({ tenantId: 't', userId: 'u', role: 'owner' as const }),
    };
    const middleware = buildAuthMiddleware({ config, jwtVerifier });
    const request = makeRequest({ authorization: 'Basic abc123' });

    await expect(middleware(request, makeReply())).rejects.toThrow('Missing or malformed Authorization header');
  });

  it('throws 401 when JWT verifier rejects token', async () => {
    const config = makeConfig({ AUTH_MODE: 'cognito' });
    const jwtVerifier: JwtVerifier = {
      verify: async () => { throw new Error('token expired'); },
    };
    const middleware = buildAuthMiddleware({ config, jwtVerifier });
    const request = makeRequest({ authorization: 'Bearer expired-token' });

    await expect(middleware(request, makeReply())).rejects.toThrow('Invalid or expired token');
  });

  it('does not call JWT verifier in local mode', async () => {
    const config = makeConfig({ AUTH_MODE: 'local' });
    let verifyCalled = false;
    const jwtVerifier: JwtVerifier = {
      verify: async () => { verifyCalled = true; return { tenantId: 't', userId: 'u', role: 'owner' as const }; },
    };
    const middleware = buildAuthMiddleware({ config, jwtVerifier });
    const request = makeRequest();

    await middleware(request, makeReply());

    expect(verifyCalled).toBe(false);
    expect(request.authContext.principal_type).toBe('internal');
  });
});
