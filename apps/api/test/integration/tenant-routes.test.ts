import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, truncateAll, getPool } from './setup.js';
import type { JwtVerifier } from '../../src/application/ports/jwt-verifier.js';

afterAll(async () => {
  await getPool().end();
});

describe('POST /v1/tenants', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('returns 201 with tenant and user on success', async () => {
    const app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: {
        businessName: 'Acme Landscaping',
        ownerEmail: 'owner@acme.test',
        ownerFullName: 'Jane Doe',
        ownerPassword: 'test-password',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.tenant.slug).toBe('acme-landscaping');
    expect(body.tenant.name).toBe('Acme Landscaping');
    expect(body.tenant.status).toBe('active');
    expect(body.user.email).toBe('owner@acme.test');
    expect(body.user.fullName).toBe('Jane Doe');
    expect(body.user.role).toBe('owner');
    expect(body.user.tenantId).toBe(body.tenant.id);
  });

  it('returns 409 for duplicate slug', async () => {
    const app = await buildTestApp();

    // First create
    await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: {
        businessName: 'Acme Landscaping',
        ownerEmail: 'owner1@acme.test',
        ownerFullName: 'Jane Doe',
        ownerPassword: 'test-password',
      },
    });

    // Duplicate
    const res = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: {
        businessName: 'Acme Landscaping',
        ownerEmail: 'owner2@acme.test',
        ownerFullName: 'John Doe',
        ownerPassword: 'test-password',
      },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error.code).toBe('CONFLICT');
  });

  it('returns 404 when AUTH_MODE is cognito', async () => {
    const noopVerifier: JwtVerifier = {
      verify: async () => { throw new Error('not used'); },
    };
    const app = await buildTestApp(
      { AUTH_MODE: 'cognito', COGNITO_USER_POOL_ID: 'us-east-1_Test', COGNITO_CLIENT_ID: 'test', COGNITO_REGION: 'us-east-1' },
      { jwtVerifier: noopVerifier },
    );

    const res = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: {
        businessName: 'Blocked Biz',
        ownerEmail: 'blocked@test.com',
        ownerFullName: 'Blocked Owner',
      },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });

  it('returns 400 when ownerPassword is missing in local mode', async () => {
    const app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: {
        businessName: 'No Password Biz',
        ownerEmail: 'nopw@test.com',
        ownerFullName: 'No PW Owner',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for invalid body', async () => {
    const app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: {
        businessName: '',
        ownerEmail: 'not-an-email',
        ownerFullName: '',
      },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('GET /v1/tenants/me', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('returns the seeded tenant for the auth context', async () => {
    const app = await buildTestApp();

    // Create a tenant first to match auth context
    await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: {
        businessName: 'My Business',
        ownerEmail: 'owner@test.com',
        ownerFullName: 'Owner',
        ownerPassword: 'test-password',
      },
    });

    // Get the created tenant id from the response
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: {
        businessName: 'Auth Tenant',
        ownerEmail: 'auth@test.com',
        ownerFullName: 'Auth Owner',
        ownerPassword: 'test-password',
      },
    });
    const created = createRes.json();

    // Build app with matching auth context
    const authedApp = await buildTestApp({
      DEV_AUTH_TENANT_ID: created.tenant.id,
      DEV_AUTH_USER_ID: created.user.id,
    });

    const res = await authedApp.inject({
      method: 'GET',
      url: '/v1/tenants/me',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(created.tenant.id);
    expect(body.name).toBe('Auth Tenant');
  });
});

describe('GET /v1/users/me', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('returns the user for the auth context', async () => {
    const app = await buildTestApp();

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: {
        businessName: 'User Tenant',
        ownerEmail: 'user@test.com',
        ownerFullName: 'Test User',
        ownerPassword: 'test-password',
      },
    });
    const created = createRes.json();

    const authedApp = await buildTestApp({
      DEV_AUTH_TENANT_ID: created.tenant.id,
      DEV_AUTH_USER_ID: created.user.id,
    });

    const res = await authedApp.inject({
      method: 'GET',
      url: '/v1/users/me',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(created.user.id);
    expect(body.email).toBe('user@test.com');
    expect(body.fullName).toBe('Test User');
  });
});
