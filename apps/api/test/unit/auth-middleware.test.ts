import { describe, it, expect } from 'vitest';
import { buildAuthMiddleware } from '../../src/adapters/http/middleware/auth-middleware.js';
import type { AppConfig } from '../../src/shared/config.js';
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
    ...overrides,
  };
}

function makeRequest(headers: Record<string, string> = {}): FastifyRequest {
  return { authContext: null, headers } as unknown as FastifyRequest;
}

function makeReply(): FastifyReply {
  return {} as FastifyReply;
}

describe('authMiddleware', () => {
  it('injects correct authContext in local mode', async () => {
    const config = makeConfig();
    const middleware = buildAuthMiddleware(config);
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
    const middleware = buildAuthMiddleware(config);
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
    const middleware = buildAuthMiddleware(config);
    const request = makeRequest();

    await middleware(request, makeReply());

    expect(request.authContext.tenant_id).toBe('custom-tenant');
    expect(request.authContext.user_id).toBe('custom-user');
    expect(request.authContext.role).toBe('admin');
  });

  it('overrides tenant/user from X-Dev headers in local mode', async () => {
    const config = makeConfig();
    const middleware = buildAuthMiddleware(config);
    const request = makeRequest({
      'x-dev-tenant-id': 'override-tenant',
      'x-dev-user-id': 'override-user',
    });

    await middleware(request, makeReply());

    expect(request.authContext.tenant_id).toBe('override-tenant');
    expect(request.authContext.user_id).toBe('override-user');
    expect(request.authContext.role).toBe('owner');
  });
});
