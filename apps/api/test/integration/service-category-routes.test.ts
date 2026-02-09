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
      businessName: 'Category Test Biz',
      ownerEmail: 'cat@test.com',
      ownerFullName: 'Category Owner',
    },
  });
  const created = createRes.json();

  const authedApp = await buildTestApp({
    DEV_AUTH_TENANT_ID: created.tenant.id,
    DEV_AUTH_USER_ID: created.user.id,
  });

  return { app: authedApp, tenant: created.tenant, user: created.user };
}

describe('POST /v1/services/categories', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('creates a category and returns 201', async () => {
    const { app, tenant } = await createTenantAndGetApp();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/services/categories',
      payload: { name: 'Lawn Care', description: 'Mowing and edging' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.name).toBe('Lawn Care');
    expect(body.description).toBe('Mowing and edging');
    expect(body.tenantId).toBe(tenant.id);
    expect(body.active).toBe(true);
    expect(body.sortOrder).toBe(0);
    expect(body.id).toBeDefined();
    expect(body.createdAt).toBeDefined();
  });

  it('returns 400 for empty name', async () => {
    const { app } = await createTenantAndGetApp();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/services/categories',
      payload: { name: '' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 409 for duplicate name in same tenant', async () => {
    const { app } = await createTenantAndGetApp();

    await app.inject({
      method: 'POST',
      url: '/v1/services/categories',
      payload: { name: 'Lawn Care' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/services/categories',
      payload: { name: 'Lawn Care' },
    });

    expect(res.statusCode).toBe(409);
  });
});

describe('GET /v1/services/categories', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('lists active categories only by default', async () => {
    const { app } = await createTenantAndGetApp();

    await app.inject({
      method: 'POST',
      url: '/v1/services/categories',
      payload: { name: 'Active Cat' },
    });

    const catRes = await app.inject({
      method: 'POST',
      url: '/v1/services/categories',
      payload: { name: 'Inactive Cat' },
    });
    const catId = catRes.json().id;

    await app.inject({
      method: 'DELETE',
      url: `/v1/services/categories/${catId}`,
    });

    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/services/categories',
    });

    expect(listRes.statusCode).toBe(200);
    const body = listRes.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Active Cat');
  });

  it('lists all categories when includeInactive=true', async () => {
    const { app } = await createTenantAndGetApp();

    await app.inject({
      method: 'POST',
      url: '/v1/services/categories',
      payload: { name: 'Active Cat' },
    });

    const catRes = await app.inject({
      method: 'POST',
      url: '/v1/services/categories',
      payload: { name: 'Inactive Cat' },
    });
    await app.inject({
      method: 'DELETE',
      url: `/v1/services/categories/${catRes.json().id}`,
    });

    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/services/categories?includeInactive=true',
    });

    expect(listRes.statusCode).toBe(200);
    expect(listRes.json()).toHaveLength(2);
  });
});

describe('PUT /v1/services/categories/:id', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('updates a category', async () => {
    const { app } = await createTenantAndGetApp();

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/services/categories',
      payload: { name: 'Original' },
    });
    const catId = createRes.json().id;

    const updateRes = await app.inject({
      method: 'PUT',
      url: `/v1/services/categories/${catId}`,
      payload: { name: 'Updated Name', description: 'Now with description' },
    });

    expect(updateRes.statusCode).toBe(200);
    const body = updateRes.json();
    expect(body.name).toBe('Updated Name');
    expect(body.description).toBe('Now with description');
  });
});

describe('GET /v1/services/categories/:id', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('returns 404 for non-existent category', async () => {
    const { app } = await createTenantAndGetApp();

    const res = await app.inject({
      method: 'GET',
      url: '/v1/services/categories/00000000-0000-0000-0000-000000000999',
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /v1/services/categories/:id', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('deactivates category and returns 204', async () => {
    const { app } = await createTenantAndGetApp();

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/services/categories',
      payload: { name: 'To Delete' },
    });
    const catId = createRes.json().id;

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/v1/services/categories/${catId}`,
    });

    expect(deleteRes.statusCode).toBe(204);
  });
});
