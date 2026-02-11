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

async function createClientWithProperty(app: ReturnType<typeof buildTestApp> extends Promise<infer T> ? T : never) {
  const clientRes = await app.inject({
    method: 'POST',
    url: '/v1/clients',
    payload: {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      phone: '555-9876',
    },
  });
  const client = clientRes.json();

  const propRes = await app.inject({
    method: 'POST',
    url: `/v1/clients/${client.id}/properties`,
    payload: {
      addressLine1: '456 Oak Ave',
      city: 'Portland',
      state: 'OR',
      zip: '97201',
    },
  });
  const property = propRes.json();

  return { client, property };
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

  it('returns 400 for invalid cursor', async () => {
    const { app } = await createTenantAndGetApp();

    const res = await app.inject({
      method: 'GET',
      url: '/v1/quotes?cursor=not-valid-base64-json',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
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
        ownerPassword: 'test-password',
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
        ownerPassword: 'test-password',
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

describe('POST /v1/quotes', () => {
  beforeEach(async () => {
    await truncateAll();
    resetRateLimitStore();
  });

  it('creates a standalone quote without property', async () => {
    const { app } = await createTenantAndGetApp();
    const { client } = await createClientWithProperty(app);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/quotes',
      payload: {
        clientId: client.id,
        title: 'Standalone Quote',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.clientId).toBe(client.id);
    expect(body.propertyId).toBeNull();
    expect(body.requestId).toBeNull();
    expect(body.title).toBe('Standalone Quote');
    expect(body.status).toBe('draft');
    expect(body.lineItems).toEqual([]);
    expect(body.subtotal).toBe(0);
    expect(body.tax).toBe(0);
    expect(body.total).toBe(0);
  });

  it('creates a standalone quote with property', async () => {
    const { app } = await createTenantAndGetApp();
    const { client, property } = await createClientWithProperty(app);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/quotes',
      payload: {
        clientId: client.id,
        propertyId: property.id,
        title: 'Quote with Property',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.clientId).toBe(client.id);
    expect(body.propertyId).toBe(property.id);
  });

  it('returns 404 for non-existent client', async () => {
    const { app } = await createTenantAndGetApp();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/quotes',
      payload: {
        clientId: '00000000-0000-0000-0000-000000000999',
        title: 'Bad Client',
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 404 for non-existent property', async () => {
    const { app } = await createTenantAndGetApp();
    const { client } = await createClientWithProperty(app);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/quotes',
      payload: {
        clientId: client.id,
        propertyId: '00000000-0000-0000-0000-000000000999',
        title: 'Bad Property',
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 400 when property does not belong to client', async () => {
    const { app } = await createTenantAndGetApp();
    const { client: clientA } = await createClientWithProperty(app);

    // Create a second client with property
    const client2Res = await app.inject({
      method: 'POST',
      url: '/v1/clients',
      payload: { firstName: 'Bob', lastName: 'Jones', email: 'bob@example.com' },
    });
    const clientB = client2Res.json();
    const prop2Res = await app.inject({
      method: 'POST',
      url: `/v1/clients/${clientB.id}/properties`,
      payload: { addressLine1: '789 Elm St' },
    });
    const propertyB = prop2Res.json();

    // Try to create quote with clientA but propertyB
    const res = await app.inject({
      method: 'POST',
      url: '/v1/quotes',
      payload: {
        clientId: clientA.id,
        propertyId: propertyB.id,
        title: 'Mismatched',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for empty title', async () => {
    const { app } = await createTenantAndGetApp();
    const { client } = await createClientWithProperty(app);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/quotes',
      payload: {
        clientId: client.id,
        title: '',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for missing clientId', async () => {
    const { app } = await createTenantAndGetApp();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/quotes',
      payload: {
        title: 'No Client',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('new quote appears in GET /v1/quotes list', async () => {
    const { app } = await createTenantAndGetApp();
    const { client } = await createClientWithProperty(app);

    await app.inject({
      method: 'POST',
      url: '/v1/quotes',
      payload: {
        clientId: client.id,
        title: 'Listed Quote',
      },
    });

    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/quotes',
    });

    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().data).toHaveLength(1);
    expect(listRes.json().data[0].title).toBe('Listed Quote');
  });

  it('enforces cross-tenant isolation', async () => {
    const { app: appA } = await createTenantAndGetApp();
    const { client: clientA } = await createClientWithProperty(appA);

    // Create tenant B
    const publicApp = await buildTestApp();
    const createBRes = await publicApp.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: {
        businessName: 'Tenant B Quote Biz',
        ownerEmail: 'b-quote@test.com',
        ownerFullName: 'Owner B',
        ownerPassword: 'test-password',
      },
    });
    const tenantB = createBRes.json();
    const appB = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenantB.tenant.id,
      DEV_AUTH_USER_ID: tenantB.user.id,
    });

    // Tenant B cannot create a quote for tenant A's client
    const res = await appB.inject({
      method: 'POST',
      url: '/v1/quotes',
      payload: {
        clientId: clientA.id,
        title: 'Cross-Tenant Attempt',
      },
    });

    expect(res.statusCode).toBe(404);
  });
});
