import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, truncateAll, getPool } from './setup.js';

afterAll(async () => {
  await getPool().end();
});

async function createTenantClientAndGetApp() {
  const app = await buildTestApp();

  const createRes = await app.inject({
    method: 'POST',
    url: '/v1/tenants',
    payload: {
      businessName: 'Property Test Biz',
      ownerEmail: 'prop-test@test.com',
      ownerFullName: 'Property Owner',
      ownerPassword: 'test-password',
    },
  });
  const created = createRes.json();

  const authedApp = await buildTestApp({
    DEV_AUTH_TENANT_ID: created.tenant.id,
    DEV_AUTH_USER_ID: created.user.id,
  });

  // Create a client to attach properties to
  const clientRes = await authedApp.inject({
    method: 'POST',
    url: '/v1/clients',
    payload: { firstName: 'John', lastName: 'Smith' },
  });
  const client = clientRes.json();

  return { app: authedApp, tenant: created.tenant, user: created.user, client };
}

describe('POST /v1/clients/:clientId/properties', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('creates a property and returns 201', async () => {
    const { app, tenant, client } = await createTenantClientAndGetApp();

    const res = await app.inject({
      method: 'POST',
      url: `/v1/clients/${client.id}/properties`,
      payload: {
        addressLine1: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zip: '62701',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.addressLine1).toBe('123 Main St');
    expect(body.clientId).toBe(client.id);
    expect(body.tenantId).toBe(tenant.id);
    expect(body.active).toBe(true);
  });

  it('returns 400 for empty address', async () => {
    const { app, client } = await createTenantClientAndGetApp();

    const res = await app.inject({
      method: 'POST',
      url: `/v1/clients/${client.id}/properties`,
      payload: { addressLine1: '' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 404 for non-existent client', async () => {
    const { app } = await createTenantClientAndGetApp();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/clients/00000000-0000-0000-0000-000000000999/properties',
      payload: { addressLine1: '123 Main St' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 409 for duplicate address on same client', async () => {
    const { app, client } = await createTenantClientAndGetApp();

    await app.inject({
      method: 'POST',
      url: `/v1/clients/${client.id}/properties`,
      payload: { addressLine1: '123 Main St' },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/v1/clients/${client.id}/properties`,
      payload: { addressLine1: '123 Main St' },
    });

    expect(res.statusCode).toBe(409);
  });
});

describe('GET /v1/clients/:clientId/properties', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('lists properties for a client', async () => {
    const { app, client } = await createTenantClientAndGetApp();

    await app.inject({
      method: 'POST',
      url: `/v1/clients/${client.id}/properties`,
      payload: { addressLine1: '123 Main St' },
    });
    await app.inject({
      method: 'POST',
      url: `/v1/clients/${client.id}/properties`,
      payload: { addressLine1: '456 Oak Ave' },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/v1/clients/${client.id}/properties`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(2);
  });
});

describe('PUT /v1/properties/:id', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('updates a property', async () => {
    const { app, client } = await createTenantClientAndGetApp();

    const createRes = await app.inject({
      method: 'POST',
      url: `/v1/clients/${client.id}/properties`,
      payload: { addressLine1: '123 Main St' },
    });
    const propId = createRes.json().id;

    const updateRes = await app.inject({
      method: 'PUT',
      url: `/v1/properties/${propId}`,
      payload: { addressLine1: '789 Elm St', city: 'Portland', state: 'OR' },
    });

    expect(updateRes.statusCode).toBe(200);
    const body = updateRes.json();
    expect(body.addressLine1).toBe('789 Elm St');
    expect(body.city).toBe('Portland');
    expect(body.state).toBe('OR');
  });
});

describe('DELETE /v1/properties/:id', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('deactivates property and returns 204', async () => {
    const { app, client } = await createTenantClientAndGetApp();

    const createRes = await app.inject({
      method: 'POST',
      url: `/v1/clients/${client.id}/properties`,
      payload: { addressLine1: '123 Main St' },
    });
    const propId = createRes.json().id;

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/v1/properties/${propId}`,
    });

    expect(deleteRes.statusCode).toBe(204);
  });
});
