import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, truncateAll, getPool, getDb } from './setup.js';
import { resetRateLimitStore } from '../../src/adapters/http/middleware/rate-limit.js';
import { quotes, serviceCategories, serviceItems } from '../../src/infra/db/schema.js';
import { eq } from 'drizzle-orm';

afterAll(async () => {
  await getPool().end();
});

async function createTenantAndGetApp() {
  const app = await buildTestApp();

  const createRes = await app.inject({
    method: 'POST',
    url: '/v1/tenants',
    payload: {
      businessName: 'Job Test Biz',
      ownerEmail: 'job-test@test.com',
      ownerFullName: 'Job Owner',
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

async function createApprovedQuote(app: ReturnType<typeof buildTestApp> extends Promise<infer T> ? T : never) {
  const { client, property } = await createClientWithProperty(app);

  // Create standalone quote
  const quoteRes = await app.inject({
    method: 'POST',
    url: '/v1/quotes',
    payload: {
      clientId: client.id,
      propertyId: property.id,
      title: 'Test Job Quote',
    },
  });
  const quote = quoteRes.json();

  // Update line items
  await app.inject({
    method: 'PUT',
    url: `/v1/quotes/${quote.id}`,
    payload: {
      lineItems: [
        { description: 'Mowing', quantity: 1, unitPrice: 4500 },
        { description: 'Edging', quantity: 1, unitPrice: 2500 },
      ],
    },
  });

  // Directly set status to approved in DB (bypassing send flow)
  const db = getDb();
  await db.update(quotes).set({
    status: 'approved',
    sentAt: new Date(),
    approvedAt: new Date(),
  }).where(eq(quotes.id, quote.id));

  return { client, property, quoteId: quote.id };
}

describe('POST /v1/jobs', () => {
  beforeEach(async () => {
    await truncateAll();
    resetRateLimitStore();
  });

  it('creates job + visit from approved quote', async () => {
    const { app } = await createTenantAndGetApp();
    const { quoteId, client, property } = await createApprovedQuote(app);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/jobs',
      payload: { quoteId },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.alreadyExisted).toBe(false);
    expect(body.job.quoteId).toBe(quoteId);
    expect(body.job.clientId).toBe(client.id);
    expect(body.job.propertyId).toBe(property.id);
    expect(body.job.title).toBe('Test Job Quote');
    expect(body.job.status).toBe('scheduled');
    expect(body.visit.jobId).toBe(body.job.id);
    expect(body.visit.status).toBe('scheduled');
    expect(body.visit.estimatedDurationMinutes).toBe(60); // default (no service items linked)
    expect(body.suggestedDurationMinutes).toBe(60);
  });

  it('returns idempotent result on second call', async () => {
    const { app } = await createTenantAndGetApp();
    const { quoteId } = await createApprovedQuote(app);

    const first = await app.inject({
      method: 'POST',
      url: '/v1/jobs',
      payload: { quoteId },
    });
    expect(first.statusCode).toBe(200);
    const firstBody = first.json();

    const second = await app.inject({
      method: 'POST',
      url: '/v1/jobs',
      payload: { quoteId },
    });
    expect(second.statusCode).toBe(200);
    const secondBody = second.json();

    expect(secondBody.alreadyExisted).toBe(true);
    expect(secondBody.job.id).toBe(firstBody.job.id);
    expect(secondBody.visit.id).toBe(firstBody.visit.id);
  });

  it('returns 400 for draft quote', async () => {
    const { app } = await createTenantAndGetApp();
    const { client, property } = await createClientWithProperty(app);

    const quoteRes = await app.inject({
      method: 'POST',
      url: '/v1/quotes',
      payload: {
        clientId: client.id,
        propertyId: property.id,
        title: 'Draft Quote',
      },
    });
    const quote = quoteRes.json();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/jobs',
      payload: { quoteId: quote.id },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for non-existent quote', async () => {
    const { app } = await createTenantAndGetApp();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/jobs',
      payload: { quoteId: '00000000-0000-0000-0000-000000000999' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('calculates duration from service items', async () => {
    const { app, tenant } = await createTenantAndGetApp();
    const { client, property } = await createClientWithProperty(app);
    const db = getDb();

    // Create service category + items with known durations
    const catId = '00000000-0000-0000-0000-000000000200';
    const svc1Id = '00000000-0000-0000-0000-000000000300';
    const svc2Id = '00000000-0000-0000-0000-000000000301';

    await db.insert(serviceCategories).values({
      id: catId,
      tenantId: tenant.id,
      name: 'Test Category',
      sortOrder: 0,
    });

    await db.insert(serviceItems).values([
      { id: svc1Id, tenantId: tenant.id, categoryId: catId, name: 'Mowing', unitPrice: 4500, unitType: 'per_visit', estimatedDurationMinutes: 45, sortOrder: 0 },
      { id: svc2Id, tenantId: tenant.id, categoryId: catId, name: 'Edging', unitPrice: 2500, unitType: 'per_visit', estimatedDurationMinutes: 30, sortOrder: 1 },
    ]);

    // Create quote with service item references
    const quoteRes = await app.inject({
      method: 'POST',
      url: '/v1/quotes',
      payload: {
        clientId: client.id,
        propertyId: property.id,
        title: 'Duration Test Quote',
      },
    });
    const quote = quoteRes.json();

    await app.inject({
      method: 'PUT',
      url: `/v1/quotes/${quote.id}`,
      payload: {
        lineItems: [
          { serviceItemId: svc1Id, description: 'Mowing', quantity: 1, unitPrice: 4500 },
          { serviceItemId: svc2Id, description: 'Edging', quantity: 1, unitPrice: 2500 },
        ],
      },
    });

    // Approve the quote
    await db.update(quotes).set({
      status: 'approved',
      sentAt: new Date(),
      approvedAt: new Date(),
    }).where(eq(quotes.id, quote.id));

    const res = await app.inject({
      method: 'POST',
      url: '/v1/jobs',
      payload: { quoteId: quote.id },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().suggestedDurationMinutes).toBe(75); // 45 + 30
    expect(res.json().visit.estimatedDurationMinutes).toBe(75);
  });
});

describe('GET /v1/jobs', () => {
  beforeEach(async () => {
    await truncateAll();
    resetRateLimitStore();
  });

  it('returns empty list when no jobs', async () => {
    const { app } = await createTenantAndGetApp();

    const res = await app.inject({
      method: 'GET',
      url: '/v1/jobs',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(0);
    expect(body.hasMore).toBe(false);
  });

  it('returns jobs after creation', async () => {
    const { app } = await createTenantAndGetApp();
    const { quoteId } = await createApprovedQuote(app);

    await app.inject({
      method: 'POST',
      url: '/v1/jobs',
      payload: { quoteId },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/jobs',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe('Test Job Quote');
    expect(body.data[0].status).toBe('scheduled');
  });

  it('filters by status', async () => {
    const { app } = await createTenantAndGetApp();
    const { quoteId } = await createApprovedQuote(app);

    await app.inject({
      method: 'POST',
      url: '/v1/jobs',
      payload: { quoteId },
    });

    const scheduled = await app.inject({
      method: 'GET',
      url: '/v1/jobs?status=scheduled',
    });
    expect(scheduled.json().data).toHaveLength(1);

    const completed = await app.inject({
      method: 'GET',
      url: '/v1/jobs?status=completed',
    });
    expect(completed.json().data).toHaveLength(0);
  });

  it('searches by title', async () => {
    const { app } = await createTenantAndGetApp();
    const { quoteId } = await createApprovedQuote(app);

    await app.inject({
      method: 'POST',
      url: '/v1/jobs',
      payload: { quoteId },
    });

    const match = await app.inject({
      method: 'GET',
      url: '/v1/jobs?search=Test+Job',
    });
    expect(match.json().data).toHaveLength(1);

    const noMatch = await app.inject({
      method: 'GET',
      url: '/v1/jobs?search=nonexistent',
    });
    expect(noMatch.json().data).toHaveLength(0);
  });
});

describe('GET /v1/jobs/count', () => {
  beforeEach(async () => {
    await truncateAll();
    resetRateLimitStore();
  });

  it('returns total count', async () => {
    const { app } = await createTenantAndGetApp();
    const { quoteId } = await createApprovedQuote(app);

    await app.inject({
      method: 'POST',
      url: '/v1/jobs',
      payload: { quoteId },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/jobs/count',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().count).toBe(1);
  });

  it('returns count filtered by status', async () => {
    const { app } = await createTenantAndGetApp();
    const { quoteId } = await createApprovedQuote(app);

    await app.inject({
      method: 'POST',
      url: '/v1/jobs',
      payload: { quoteId },
    });

    const scheduled = await app.inject({
      method: 'GET',
      url: '/v1/jobs/count?status=scheduled',
    });
    expect(scheduled.json().count).toBe(1);

    const completed = await app.inject({
      method: 'GET',
      url: '/v1/jobs/count?status=completed',
    });
    expect(completed.json().count).toBe(0);
  });
});

describe('GET /v1/jobs/:id', () => {
  beforeEach(async () => {
    await truncateAll();
    resetRateLimitStore();
  });

  it('returns job with embedded visits', async () => {
    const { app } = await createTenantAndGetApp();
    const { quoteId } = await createApprovedQuote(app);

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/jobs',
      payload: { quoteId },
    });
    const jobId = createRes.json().job.id;

    const res = await app.inject({
      method: 'GET',
      url: `/v1/jobs/${jobId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(jobId);
    expect(body.visits).toHaveLength(1);
    expect(body.visits[0].status).toBe('scheduled');
    expect(body.visits[0].estimatedDurationMinutes).toBe(60);
  });

  it('returns 404 for non-existent job', async () => {
    const { app } = await createTenantAndGetApp();

    const res = await app.inject({
      method: 'GET',
      url: '/v1/jobs/00000000-0000-0000-0000-000000000999',
    });

    expect(res.statusCode).toBe(404);
  });

  it('enforces tenant isolation', async () => {
    const { app: appA } = await createTenantAndGetApp();
    const { quoteId } = await createApprovedQuote(appA);

    const createRes = await appA.inject({
      method: 'POST',
      url: '/v1/jobs',
      payload: { quoteId },
    });
    const jobId = createRes.json().job.id;

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

    // Tenant B cannot access tenant A's job
    const res = await appB.inject({
      method: 'GET',
      url: `/v1/jobs/${jobId}`,
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('GET /v1/jobs/by-quote/:quoteId', () => {
  beforeEach(async () => {
    await truncateAll();
    resetRateLimitStore();
  });

  it('returns job with visits by quote id', async () => {
    const { app } = await createTenantAndGetApp();
    const { quoteId } = await createApprovedQuote(app);

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/jobs',
      payload: { quoteId },
    });
    const jobId = createRes.json().job.id;

    const res = await app.inject({
      method: 'GET',
      url: `/v1/jobs/by-quote/${quoteId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(jobId);
    expect(body.quoteId).toBe(quoteId);
    expect(body.visits).toHaveLength(1);
  });

  it('returns 404 when no job exists for quote', async () => {
    const { app } = await createTenantAndGetApp();

    const res = await app.inject({
      method: 'GET',
      url: '/v1/jobs/by-quote/00000000-0000-0000-0000-000000000999',
    });

    expect(res.statusCode).toBe(404);
  });
});
