import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, truncateAll, getPool } from './setup.js';

afterAll(async () => {
  await getPool().end();
});

async function createTenantAndGetApp() {
  const app = await buildTestApp();

  const createRes = await app.inject({
    method: 'POST',
    url: '/v1/tenants',
    payload: {
      businessName: 'Client Test Biz',
      ownerEmail: 'client-test@test.com',
      ownerFullName: 'Client Owner',
    },
  });
  const created = createRes.json();

  const authedApp = await buildTestApp({
    DEV_AUTH_TENANT_ID: created.tenant.id,
    DEV_AUTH_USER_ID: created.user.id,
  });

  return { app: authedApp, tenant: created.tenant, user: created.user };
}

describe('POST /v1/clients', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('creates a client and returns 201', async () => {
    const { app, tenant } = await createTenantAndGetApp();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/clients',
      payload: { firstName: 'John', lastName: 'Smith', email: 'john@example.com' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.firstName).toBe('John');
    expect(body.lastName).toBe('Smith');
    expect(body.email).toBe('john@example.com');
    expect(body.tenantId).toBe(tenant.id);
    expect(body.active).toBe(true);
    expect(body.tags).toEqual([]);
    expect(body.id).toBeDefined();
    expect(body.createdAt).toBeDefined();
  });

  it('returns 400 for empty first name', async () => {
    const { app } = await createTenantAndGetApp();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/clients',
      payload: { firstName: '', lastName: 'Smith' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 409 for duplicate email in same tenant', async () => {
    const { app } = await createTenantAndGetApp();

    await app.inject({
      method: 'POST',
      url: '/v1/clients',
      payload: { firstName: 'John', lastName: 'Smith', email: 'dupe@example.com' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/clients',
      payload: { firstName: 'Jane', lastName: 'Doe', email: 'dupe@example.com' },
    });

    expect(res.statusCode).toBe(409);
  });

  it('allows null email (phone-only clients)', async () => {
    const { app } = await createTenantAndGetApp();

    const res1 = await app.inject({
      method: 'POST',
      url: '/v1/clients',
      payload: { firstName: 'John', lastName: 'Smith', phone: '555-1234' },
    });
    expect(res1.statusCode).toBe(201);

    const res2 = await app.inject({
      method: 'POST',
      url: '/v1/clients',
      payload: { firstName: 'Jane', lastName: 'Doe', phone: '555-5678' },
    });
    expect(res2.statusCode).toBe(201);
  });
});

describe('GET /v1/clients', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('returns paginated list of active clients', async () => {
    const { app } = await createTenantAndGetApp();

    await app.inject({
      method: 'POST',
      url: '/v1/clients',
      payload: { firstName: 'Alice', lastName: 'Anderson' },
    });
    await app.inject({
      method: 'POST',
      url: '/v1/clients',
      payload: { firstName: 'Bob', lastName: 'Baker' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/clients',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(2);
    expect(body.hasMore).toBe(false);
    expect(body.cursor).toBeNull();
  });

  it('paginates with correct page sizes', async () => {
    const { app } = await createTenantAndGetApp();

    // Create 3 clients
    for (let i = 0; i < 3; i++) {
      await app.inject({
        method: 'POST',
        url: '/v1/clients',
        payload: { firstName: `Client${i}`, lastName: 'Test' },
      });
    }

    // Request page of 2
    const page1 = await app.inject({
      method: 'GET',
      url: '/v1/clients?limit=2',
    });
    const body1 = page1.json();
    expect(body1.data).toHaveLength(2);
    expect(body1.hasMore).toBe(true);
    expect(body1.cursor).toBeDefined();

    // Second page via cursor
    const page2 = await app.inject({
      method: 'GET',
      url: `/v1/clients?limit=2&cursor=${body1.cursor}`,
    });
    const body2 = page2.json();
    expect(body2.data).toHaveLength(1);
    expect(body2.hasMore).toBe(false);
    expect(body2.cursor).toBeNull();
  });

  it('filters by search term across name and email', async () => {
    const { app } = await createTenantAndGetApp();

    await app.inject({
      method: 'POST',
      url: '/v1/clients',
      payload: { firstName: 'John', lastName: 'Smith', email: 'john@example.com' },
    });
    await app.inject({
      method: 'POST',
      url: '/v1/clients',
      payload: { firstName: 'Jane', lastName: 'Doe', email: 'jane@other.com' },
    });

    // Search by first name
    const res1 = await app.inject({
      method: 'GET',
      url: '/v1/clients?search=John',
    });
    expect(res1.json().data).toHaveLength(1);
    expect(res1.json().data[0].firstName).toBe('John');

    // Search by email
    const res2 = await app.inject({
      method: 'GET',
      url: '/v1/clients?search=other.com',
    });
    expect(res2.json().data).toHaveLength(1);
    expect(res2.json().data[0].firstName).toBe('Jane');
  });

  it('excludes inactive clients by default', async () => {
    const { app } = await createTenantAndGetApp();

    await app.inject({
      method: 'POST',
      url: '/v1/clients',
      payload: { firstName: 'Active', lastName: 'Client' },
    });

    const inactiveRes = await app.inject({
      method: 'POST',
      url: '/v1/clients',
      payload: { firstName: 'Inactive', lastName: 'Client' },
    });
    await app.inject({
      method: 'DELETE',
      url: `/v1/clients/${inactiveRes.json().id}`,
    });

    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/clients',
    });
    expect(listRes.json().data).toHaveLength(1);
    expect(listRes.json().data[0].firstName).toBe('Active');
  });
});

describe('GET /v1/clients/:id', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('returns 404 for non-existent client', async () => {
    const { app } = await createTenantAndGetApp();

    const res = await app.inject({
      method: 'GET',
      url: '/v1/clients/00000000-0000-0000-0000-000000000999',
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('PUT /v1/clients/:id', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('updates a client', async () => {
    const { app } = await createTenantAndGetApp();

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/clients',
      payload: { firstName: 'John', lastName: 'Smith' },
    });
    const clientId = createRes.json().id;

    const updateRes = await app.inject({
      method: 'PUT',
      url: `/v1/clients/${clientId}`,
      payload: { firstName: 'Jonathan', company: 'Smith LLC' },
    });

    expect(updateRes.statusCode).toBe(200);
    const body = updateRes.json();
    expect(body.firstName).toBe('Jonathan');
    expect(body.company).toBe('Smith LLC');
  });
});

describe('DELETE /v1/clients/:id', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('deactivates client and returns 204', async () => {
    const { app } = await createTenantAndGetApp();

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/clients',
      payload: { firstName: 'John', lastName: 'Smith' },
    });
    const clientId = createRes.json().id;

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/v1/clients/${clientId}`,
    });

    expect(deleteRes.statusCode).toBe(204);
  });

  it('cascades deactivation to child properties', async () => {
    const { app } = await createTenantAndGetApp();

    // Create client with two properties
    const clientRes = await app.inject({
      method: 'POST',
      url: '/v1/clients',
      payload: { firstName: 'John', lastName: 'Smith' },
    });
    const clientId = clientRes.json().id;

    await app.inject({
      method: 'POST',
      url: `/v1/clients/${clientId}/properties`,
      payload: { addressLine1: '123 Main St', city: 'Springfield', state: 'IL', zip: '62701' },
    });
    await app.inject({
      method: 'POST',
      url: `/v1/clients/${clientId}/properties`,
      payload: { addressLine1: '456 Oak Ave', city: 'Springfield', state: 'IL', zip: '62701' },
    });

    // Verify properties exist
    const beforeList = await app.inject({
      method: 'GET',
      url: `/v1/clients/${clientId}/properties`,
    });
    expect(beforeList.json()).toHaveLength(2);

    // Delete the client
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/v1/clients/${clientId}`,
    });
    expect(deleteRes.statusCode).toBe(204);

    // Verify properties are deactivated
    const afterList = await app.inject({
      method: 'GET',
      url: `/v1/clients/${clientId}/properties`,
    });
    expect(afterList.json()).toHaveLength(0);

    // Verify properties still exist when including inactive
    const inactiveList = await app.inject({
      method: 'GET',
      url: `/v1/clients/${clientId}/properties?includeInactive=true`,
    });
    expect(inactiveList.json()).toHaveLength(2);
    expect(inactiveList.json().every((p: { active: boolean }) => p.active === false)).toBe(true);
  });
});

describe('GET /v1/clients/count', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('returns count of active clients', async () => {
    const { app } = await createTenantAndGetApp();

    await app.inject({
      method: 'POST',
      url: '/v1/clients',
      payload: { firstName: 'John', lastName: 'Smith' },
    });
    await app.inject({
      method: 'POST',
      url: '/v1/clients',
      payload: { firstName: 'Jane', lastName: 'Doe' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/clients/count',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().count).toBe(2);
  });
});
