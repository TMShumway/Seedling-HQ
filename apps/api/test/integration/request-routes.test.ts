import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, truncateAll, getPool } from './setup.js';
import { resetRateLimitStore } from '../../src/adapters/http/middleware/rate-limit.js';

afterAll(async () => {
  await getPool().end();
});

async function createTenantAndGetApp() {
  const app = await buildTestApp();

  const createRes = await app.inject({
    method: 'POST',
    url: '/v1/tenants',
    payload: {
      businessName: 'Request Test Biz',
      ownerEmail: 'request-test@test.com',
      ownerFullName: 'Request Owner',
      ownerPassword: 'test-password',
    },
  });
  const created = createRes.json();

  const authedApp = await buildTestApp({
    DEV_AUTH_TENANT_ID: created.tenant.id,
    DEV_AUTH_USER_ID: created.user.id,
  });

  return { app: authedApp, tenant: created.tenant, user: created.user };
}

describe('POST /v1/public/requests/:tenantSlug', () => {
  beforeEach(async () => {
    await truncateAll();
    resetRateLimitStore();
  });

  it('creates a request and returns 201', async () => {
    const { tenant } = await createTenantAndGetApp();

    const app = await buildTestApp(); // unauthenticated app
    const res = await app.inject({
      method: 'POST',
      url: `/v1/public/requests/${tenant.slug}`,
      payload: {
        clientName: 'John Smith',
        clientEmail: 'john@example.com',
        clientPhone: '555-1234',
        description: 'I need lawn service for my front yard',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.status).toBe('new');
    expect(body.createdAt).toBeDefined();
    // Should NOT expose tenantId or internal fields
    expect(body.tenantId).toBeUndefined();
    expect(body.source).toBeUndefined();
  });

  it('returns 400 for missing required fields', async () => {
    const { tenant } = await createTenantAndGetApp();
    const app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/v1/public/requests/${tenant.slug}`,
      payload: { clientName: '', clientEmail: 'x@x.com', description: 'hi' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 404 for nonexistent slug', async () => {
    await createTenantAndGetApp();
    const app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/public/requests/nonexistent-slug',
      payload: {
        clientName: 'John',
        clientEmail: 'john@example.com',
        description: 'Test request',
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('honeypot returns 201 but does not persist', async () => {
    const { app: authedApp, tenant } = await createTenantAndGetApp();
    const app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/v1/public/requests/${tenant.slug}`,
      payload: {
        clientName: 'Bot User',
        clientEmail: 'bot@spam.com',
        description: 'Buy stuff',
        website: 'http://spam.com', // honeypot field
      },
    });

    expect(res.statusCode).toBe(201);

    // Verify nothing was persisted
    const listRes = await authedApp.inject({
      method: 'GET',
      url: '/v1/requests',
    });
    expect(listRes.json().data).toHaveLength(0);
  });

  it('returns 429 when rate limit exceeded', async () => {
    const { tenant } = await createTenantAndGetApp();
    const app = await buildTestApp();

    // Send 5 requests (within limit)
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/public/requests/${tenant.slug}`,
        payload: {
          clientName: `User ${i}`,
          clientEmail: `user${i}@example.com`,
          description: 'Service request',
        },
      });
      expect(res.statusCode).toBe(201);
    }

    // 6th request should be rate limited
    const res = await app.inject({
      method: 'POST',
      url: `/v1/public/requests/${tenant.slug}`,
      payload: {
        clientName: 'User 6',
        clientEmail: 'user6@example.com',
        description: 'One too many',
      },
    });
    expect(res.statusCode).toBe(429);
    expect(res.json().error.code).toBe('RATE_LIMITED');
  });
});

describe('GET /v1/requests', () => {
  beforeEach(async () => {
    await truncateAll();
    resetRateLimitStore();
  });

  it('returns paginated list of requests', async () => {
    const { app, tenant } = await createTenantAndGetApp();
    const publicApp = await buildTestApp();

    // Create 2 requests via public API
    for (let i = 0; i < 2; i++) {
      await publicApp.inject({
        method: 'POST',
        url: `/v1/public/requests/${tenant.slug}`,
        payload: {
          clientName: `Client ${i}`,
          clientEmail: `client${i}@example.com`,
          description: `Request ${i}`,
        },
      });
    }

    const res = await app.inject({
      method: 'GET',
      url: '/v1/requests',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(2);
    expect(body.hasMore).toBe(false);
  });

  it('filters by search term', async () => {
    const { app, tenant } = await createTenantAndGetApp();
    const publicApp = await buildTestApp();

    await publicApp.inject({
      method: 'POST',
      url: `/v1/public/requests/${tenant.slug}`,
      payload: {
        clientName: 'Alice Anderson',
        clientEmail: 'alice@example.com',
        description: 'Lawn care needed',
      },
    });
    await publicApp.inject({
      method: 'POST',
      url: `/v1/public/requests/${tenant.slug}`,
      payload: {
        clientName: 'Bob Baker',
        clientEmail: 'bob@other.com',
        description: 'Tree removal',
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/requests?search=Alice',
    });

    expect(res.json().data).toHaveLength(1);
    expect(res.json().data[0].clientName).toBe('Alice Anderson');
  });
});

describe('GET /v1/requests/:id', () => {
  beforeEach(async () => {
    await truncateAll();
    resetRateLimitStore();
  });

  it('returns request by id', async () => {
    const { app, tenant } = await createTenantAndGetApp();
    const publicApp = await buildTestApp();

    const createRes = await publicApp.inject({
      method: 'POST',
      url: `/v1/public/requests/${tenant.slug}`,
      payload: {
        clientName: 'John Smith',
        clientEmail: 'john@example.com',
        description: 'Service needed',
      },
    });
    const requestId = createRes.json().id;

    const res = await app.inject({
      method: 'GET',
      url: `/v1/requests/${requestId}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().clientName).toBe('John Smith');
    expect(res.json().source).toBe('public_form');
  });

  it('returns 404 for non-existent request', async () => {
    const { app } = await createTenantAndGetApp();

    const res = await app.inject({
      method: 'GET',
      url: '/v1/requests/00000000-0000-0000-0000-000000000999',
    });

    expect(res.statusCode).toBe(404);
  });

  it('enforces cross-tenant isolation', async () => {
    // Create tenant A with a request
    const { tenant: tenantA } = await createTenantAndGetApp();
    const publicApp = await buildTestApp();

    const createRes = await publicApp.inject({
      method: 'POST',
      url: `/v1/public/requests/${tenantA.slug}`,
      payload: {
        clientName: 'Tenant A Client',
        clientEmail: 'a@example.com',
        description: 'Request for A',
      },
    });
    const requestId = createRes.json().id;

    // Create tenant B
    const createBRes = await publicApp.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: {
        businessName: 'Tenant B Biz',
        ownerEmail: 'b@test.com',
        ownerFullName: 'Owner B',
        ownerPassword: 'test-password',
      },
    });
    const tenantB = createBRes.json();

    const appB = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenantB.tenant.id,
      DEV_AUTH_USER_ID: tenantB.user.id,
    });

    // Tenant B should not see Tenant A's request
    const res = await appB.inject({
      method: 'GET',
      url: `/v1/requests/${requestId}`,
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('GET /v1/requests/count', () => {
  beforeEach(async () => {
    await truncateAll();
    resetRateLimitStore();
  });

  it('returns total count', async () => {
    const { app, tenant } = await createTenantAndGetApp();
    const publicApp = await buildTestApp();

    await publicApp.inject({
      method: 'POST',
      url: `/v1/public/requests/${tenant.slug}`,
      payload: {
        clientName: 'Client 1',
        clientEmail: 'c1@example.com',
        description: 'Request 1',
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/requests/count',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().count).toBe(1);
  });

  it('returns count filtered by status', async () => {
    const { app, tenant } = await createTenantAndGetApp();
    const publicApp = await buildTestApp();

    await publicApp.inject({
      method: 'POST',
      url: `/v1/public/requests/${tenant.slug}`,
      payload: {
        clientName: 'Client 1',
        clientEmail: 'c1@example.com',
        description: 'Request 1',
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/requests/count?status=new',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().count).toBe(1);

    const res2 = await app.inject({
      method: 'GET',
      url: '/v1/requests/count?status=reviewed',
    });
    expect(res2.json().count).toBe(0);
  });
});
