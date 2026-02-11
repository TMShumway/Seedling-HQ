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
      businessName: 'Convert Test Biz',
      ownerEmail: 'convert-test@test.com',
      ownerFullName: 'Convert Owner',
      ownerPassword: 'test-password',
    },
  });
  const created = createRes.json();

  const authedApp = await buildTestApp({
    DEV_AUTH_TENANT_ID: created.tenant.id,
    DEV_AUTH_USER_ID: created.user.id,
  });

  return { app: authedApp, publicApp: app, tenant: created.tenant, user: created.user };
}

async function createRequest(publicApp: any, slug: string) {
  resetRateLimitStore();
  const res = await publicApp.inject({
    method: 'POST',
    url: `/v1/public/requests/${slug}`,
    payload: {
      clientName: 'John Smith',
      clientEmail: 'john@example.com',
      clientPhone: '555-1234',
      description: 'Need lawn mowing service',
    },
  });
  return res.json();
}

describe('POST /v1/requests/:id/convert', () => {
  beforeEach(async () => {
    await truncateAll();
    resetRateLimitStore();
  });

  it('converts request and returns 200 with all entities', async () => {
    const { app, publicApp, tenant } = await createTenantAndGetApp();
    const req = await createRequest(publicApp, tenant.slug);

    const res = await app.inject({
      method: 'POST',
      url: `/v1/requests/${req.id}/convert`,
      payload: {
        firstName: 'John',
        lastName: 'Smith',
        email: 'john@example.com',
        phone: '555-1234',
        addressLine1: '456 Oak Ave',
        city: 'Springfield',
        state: 'IL',
        zip: '62701',
        quoteTitle: 'Service for John Smith',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    // Request is converted
    expect(body.request.status).toBe('converted');

    // Client created
    expect(body.clientCreated).toBe(true);
    expect(body.client.firstName).toBe('John');
    expect(body.client.lastName).toBe('Smith');
    expect(body.client.email).toBe('john@example.com');

    // Property created
    expect(body.property.addressLine1).toBe('456 Oak Ave');
    expect(body.property.clientId).toBe(body.client.id);

    // Quote draft created
    expect(body.quote.title).toBe('Service for John Smith');
    expect(body.quote.status).toBe('draft');
    expect(body.quote.requestId).toBe(req.id);
    expect(body.quote.clientId).toBe(body.client.id);
    expect(body.quote.propertyId).toBe(body.property.id);
  });

  it('uses existing client when existingClientId is provided', async () => {
    const { app, publicApp, tenant } = await createTenantAndGetApp();
    const req = await createRequest(publicApp, tenant.slug);

    // Create a client first
    const clientRes = await app.inject({
      method: 'POST',
      url: '/v1/clients',
      payload: {
        firstName: 'Existing',
        lastName: 'Client',
        email: 'existing@example.com',
      },
    });
    const existingClient = clientRes.json();

    const res = await app.inject({
      method: 'POST',
      url: `/v1/requests/${req.id}/convert`,
      payload: {
        existingClientId: existingClient.id,
        firstName: 'Existing',
        lastName: 'Client',
        addressLine1: '789 Pine Rd',
        quoteTitle: 'Service for Existing Client',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.clientCreated).toBe(false);
    expect(body.client.id).toBe(existingClient.id);
  });

  it('returns 400 for already-converted request', async () => {
    const { app, publicApp, tenant } = await createTenantAndGetApp();
    const req = await createRequest(publicApp, tenant.slug);

    // Convert once
    await app.inject({
      method: 'POST',
      url: `/v1/requests/${req.id}/convert`,
      payload: {
        firstName: 'John',
        lastName: 'Smith',
        addressLine1: '123 Main St',
        quoteTitle: 'First conversion',
      },
    });

    // Try to convert again
    const res = await app.inject({
      method: 'POST',
      url: `/v1/requests/${req.id}/convert`,
      payload: {
        firstName: 'John',
        lastName: 'Smith',
        addressLine1: '456 Other St',
        quoteTitle: 'Second conversion',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for non-existent request', async () => {
    const { app } = await createTenantAndGetApp();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/requests/00000000-0000-0000-0000-000000000999/convert',
      payload: {
        firstName: 'Nobody',
        lastName: 'Here',
        addressLine1: '123 Main St',
        quoteTitle: 'Service',
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('enforces cross-tenant isolation', async () => {
    const { publicApp, tenant: tenantA } = await createTenantAndGetApp();
    const req = await createRequest(publicApp, tenantA.slug);

    // Create tenant B
    const createBRes = await publicApp.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: {
        businessName: 'Tenant B Convert',
        ownerEmail: 'b-convert@test.com',
        ownerFullName: 'Owner B',
        ownerPassword: 'test-password',
      },
    });
    const tenantB = createBRes.json();

    const appB = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenantB.tenant.id,
      DEV_AUTH_USER_ID: tenantB.user.id,
    });

    // Tenant B should not be able to convert Tenant A's request
    const res = await appB.inject({
      method: 'POST',
      url: `/v1/requests/${req.id}/convert`,
      payload: {
        firstName: 'Sneaky',
        lastName: 'User',
        addressLine1: '123 Main St',
        quoteTitle: 'Cross-tenant attempt',
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 404 for non-existent existingClientId', async () => {
    const { app, publicApp, tenant } = await createTenantAndGetApp();
    const req = await createRequest(publicApp, tenant.slug);

    const res = await app.inject({
      method: 'POST',
      url: `/v1/requests/${req.id}/convert`,
      payload: {
        existingClientId: '00000000-0000-0000-0000-000000000999',
        firstName: 'Ghost',
        lastName: 'Client',
        addressLine1: '123 Main St',
        quoteTitle: 'Service',
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('quote draft has correct initial values', async () => {
    const { app, publicApp, tenant } = await createTenantAndGetApp();
    const req = await createRequest(publicApp, tenant.slug);

    const res = await app.inject({
      method: 'POST',
      url: `/v1/requests/${req.id}/convert`,
      payload: {
        firstName: 'John',
        lastName: 'Smith',
        addressLine1: '123 Main St',
        quoteTitle: 'Service for John Smith',
      },
    });

    const body = res.json();
    expect(body.quote.status).toBe('draft');
    expect(body.quote.lineItems).toEqual([]);
    expect(body.quote.subtotal).toBe(0);
    expect(body.quote.tax).toBe(0);
    expect(body.quote.total).toBe(0);
    expect(body.quote.sentAt).toBeNull();
    expect(body.quote.approvedAt).toBeNull();
    expect(body.quote.declinedAt).toBeNull();
  });
});
