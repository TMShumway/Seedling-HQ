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
      businessName: 'Quote Test Biz',
      ownerEmail: 'quote-test@test.com',
      ownerFullName: 'Quote Owner',
    },
  });
  const created = createRes.json();

  const authedApp = await buildTestApp({
    DEV_AUTH_TENANT_ID: created.tenant.id,
    DEV_AUTH_USER_ID: created.user.id,
  });

  return { app: authedApp, tenant: created.tenant, user: created.user };
}

async function createQuoteViaConvert(app: ReturnType<typeof buildTestApp> extends Promise<infer T> ? T : never, tenantSlug: string) {
  const publicApp = await buildTestApp();
  resetRateLimitStore();

  // Create a public request
  const reqRes = await publicApp.inject({
    method: 'POST',
    url: `/v1/public/requests/${tenantSlug}`,
    payload: {
      clientName: 'John Smith',
      clientEmail: 'john@example.com',
      clientPhone: '555-1234',
      description: 'Need lawn service',
    },
  });
  const requestId = reqRes.json().id;

  // Convert it
  const convertRes = await app.inject({
    method: 'POST',
    url: `/v1/requests/${requestId}/convert`,
    payload: {
      firstName: 'John',
      lastName: 'Smith',
      email: 'john@example.com',
      addressLine1: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      zip: '62701',
      quoteTitle: 'Lawn Service for John Smith',
    },
  });
  return convertRes.json();
}

describe('GET /v1/quotes', () => {
  beforeEach(async () => {
    await truncateAll();
    resetRateLimitStore();
  });

  it('returns empty list when no quotes exist', async () => {
    const { app } = await createTenantAndGetApp();

    const res = await app.inject({
      method: 'GET',
      url: '/v1/quotes',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(0);
    expect(body.hasMore).toBe(false);
  });

  it('returns quotes after conversion', async () => {
    const { app, tenant } = await createTenantAndGetApp();
    await createQuoteViaConvert(app, tenant.slug);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/quotes',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe('Lawn Service for John Smith');
    expect(body.data[0].status).toBe('draft');
  });

  it('filters by status', async () => {
    const { app, tenant } = await createTenantAndGetApp();
    await createQuoteViaConvert(app, tenant.slug);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/quotes?status=draft',
    });
    expect(res.json().data).toHaveLength(1);

    const res2 = await app.inject({
      method: 'GET',
      url: '/v1/quotes?status=sent',
    });
    expect(res2.json().data).toHaveLength(0);
  });

  it('searches by title', async () => {
    const { app, tenant } = await createTenantAndGetApp();
    await createQuoteViaConvert(app, tenant.slug);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/quotes?search=Lawn',
    });
    expect(res.json().data).toHaveLength(1);

    const res2 = await app.inject({
      method: 'GET',
      url: '/v1/quotes?search=nonexistent',
    });
    expect(res2.json().data).toHaveLength(0);
  });
});

describe('GET /v1/quotes/count', () => {
  beforeEach(async () => {
    await truncateAll();
    resetRateLimitStore();
  });

  it('returns total count', async () => {
    const { app, tenant } = await createTenantAndGetApp();
    await createQuoteViaConvert(app, tenant.slug);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/quotes/count',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().count).toBe(1);
  });

  it('returns count filtered by status', async () => {
    const { app, tenant } = await createTenantAndGetApp();
    await createQuoteViaConvert(app, tenant.slug);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/quotes/count?status=draft',
    });
    expect(res.json().count).toBe(1);

    const res2 = await app.inject({
      method: 'GET',
      url: '/v1/quotes/count?status=sent',
    });
    expect(res2.json().count).toBe(0);
  });
});

describe('GET /v1/quotes/:id', () => {
  beforeEach(async () => {
    await truncateAll();
    resetRateLimitStore();
  });

  it('returns quote by id', async () => {
    const { app, tenant } = await createTenantAndGetApp();
    const converted = await createQuoteViaConvert(app, tenant.slug);

    const res = await app.inject({
      method: 'GET',
      url: `/v1/quotes/${converted.quote.id}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe('Lawn Service for John Smith');
    expect(res.json().clientId).toBe(converted.client.id);
  });

  it('returns 404 for non-existent quote', async () => {
    const { app } = await createTenantAndGetApp();

    const res = await app.inject({
      method: 'GET',
      url: '/v1/quotes/00000000-0000-0000-0000-000000000999',
    });

    expect(res.statusCode).toBe(404);
  });

  it('enforces cross-tenant isolation', async () => {
    const { app: appA, tenant: tenantA } = await createTenantAndGetApp();
    const converted = await createQuoteViaConvert(appA, tenantA.slug);

    // Create tenant B
    const publicApp = await buildTestApp();
    const createBRes = await publicApp.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: {
        businessName: 'Tenant B Biz',
        ownerEmail: 'b@test.com',
        ownerFullName: 'Owner B',
      },
    });
    const tenantB = createBRes.json();

    const appB = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenantB.tenant.id,
      DEV_AUTH_USER_ID: tenantB.user.id,
    });

    const res = await appB.inject({
      method: 'GET',
      url: `/v1/quotes/${converted.quote.id}`,
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('PUT /v1/quotes/:id', () => {
  beforeEach(async () => {
    await truncateAll();
    resetRateLimitStore();
  });

  it('updates title', async () => {
    const { app, tenant } = await createTenantAndGetApp();
    const converted = await createQuoteViaConvert(app, tenant.slug);

    const res = await app.inject({
      method: 'PUT',
      url: `/v1/quotes/${converted.quote.id}`,
      payload: { title: 'Updated Title' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe('Updated Title');
  });

  it('updates line items and recalculates totals', async () => {
    const { app, tenant } = await createTenantAndGetApp();
    const converted = await createQuoteViaConvert(app, tenant.slug);

    const res = await app.inject({
      method: 'PUT',
      url: `/v1/quotes/${converted.quote.id}`,
      payload: {
        lineItems: [
          { description: 'Weekly Mowing', quantity: 4, unitPrice: 4500 },
          { description: 'Edging', quantity: 4, unitPrice: 2500 },
        ],
        tax: 500,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.lineItems).toHaveLength(2);
    expect(body.lineItems[0].total).toBe(18000); // 4 * 4500
    expect(body.lineItems[1].total).toBe(10000); // 4 * 2500
    expect(body.subtotal).toBe(28000);
    expect(body.tax).toBe(500);
    expect(body.total).toBe(28500);
  });

  it('returns 400 for non-draft quote', async () => {
    const { app, tenant } = await createTenantAndGetApp();
    const converted = await createQuoteViaConvert(app, tenant.slug);

    // Directly update status in DB to simulate sent quote
    const { getDb } = await import('./setup.js');
    const { quotes } = await import('../../src/infra/db/schema.js');
    const { eq } = await import('drizzle-orm');
    await getDb().update(quotes).set({ status: 'sent' }).where(eq(quotes.id, converted.quote.id));

    const res = await app.inject({
      method: 'PUT',
      url: `/v1/quotes/${converted.quote.id}`,
      payload: { title: 'Should Fail' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('enforces cross-tenant isolation on PUT', async () => {
    const { app: appA, tenant: tenantA } = await createTenantAndGetApp();
    const converted = await createQuoteViaConvert(appA, tenantA.slug);

    // Create tenant B
    const publicApp = await buildTestApp();
    const createBRes = await publicApp.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: {
        businessName: 'Tenant B Biz',
        ownerEmail: 'b2@test.com',
        ownerFullName: 'Owner B',
      },
    });
    const tenantB = createBRes.json();

    const appB = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenantB.tenant.id,
      DEV_AUTH_USER_ID: tenantB.user.id,
    });

    const res = await appB.inject({
      method: 'PUT',
      url: `/v1/quotes/${converted.quote.id}`,
      payload: { title: 'Hacker Title' },
    });
    expect(res.statusCode).toBe(404);
  });
});
