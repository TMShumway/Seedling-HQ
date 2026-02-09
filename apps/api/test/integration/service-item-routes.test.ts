import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, truncateAll, getPool } from './setup.js';

afterAll(async () => {
  await getPool().end();
});

async function createTenantCategoryAndGetApp() {
  const app = await buildTestApp();

  const createRes = await app.inject({
    method: 'POST',
    url: '/v1/tenants',
    payload: {
      businessName: 'Service Test Biz',
      ownerEmail: 'svc@test.com',
      ownerFullName: 'Service Owner',
    },
  });
  const created = createRes.json();

  const authedApp = await buildTestApp({
    DEV_AUTH_TENANT_ID: created.tenant.id,
    DEV_AUTH_USER_ID: created.user.id,
  });

  // Create a category for service items
  const catRes = await authedApp.inject({
    method: 'POST',
    url: '/v1/services/categories',
    payload: { name: 'Lawn Care' },
  });
  const category = catRes.json();

  return { app: authedApp, tenant: created.tenant, user: created.user, category };
}

describe('POST /v1/services', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('creates a service item and returns 201', async () => {
    const { app, tenant, category } = await createTenantCategoryAndGetApp();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/services',
      payload: {
        categoryId: category.id,
        name: 'Weekly Mowing',
        unitPrice: 4500,
        unitType: 'per_visit',
        estimatedDurationMinutes: 45,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.name).toBe('Weekly Mowing');
    expect(body.unitPrice).toBe(4500);
    expect(body.unitType).toBe('per_visit');
    expect(body.estimatedDurationMinutes).toBe(45);
    expect(body.categoryId).toBe(category.id);
    expect(body.tenantId).toBe(tenant.id);
    expect(body.active).toBe(true);
  });

  it('returns 400 for invalid unitType', async () => {
    const { app, category } = await createTenantCategoryAndGetApp();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/services',
      payload: {
        categoryId: category.id,
        name: 'Bad Service',
        unitPrice: 1000,
        unitType: 'invalid_type',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for negative price', async () => {
    const { app, category } = await createTenantCategoryAndGetApp();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/services',
      payload: {
        categoryId: category.id,
        name: 'Bad Service',
        unitPrice: -100,
        unitType: 'flat',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 404 for non-existent categoryId', async () => {
    const { app } = await createTenantCategoryAndGetApp();

    const res = await app.inject({
      method: 'POST',
      url: '/v1/services',
      payload: {
        categoryId: '00000000-0000-0000-0000-000000000999',
        name: 'Bad Service',
        unitPrice: 1000,
        unitType: 'flat',
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 409 for duplicate name in same category', async () => {
    const { app, category } = await createTenantCategoryAndGetApp();

    await app.inject({
      method: 'POST',
      url: '/v1/services',
      payload: {
        categoryId: category.id,
        name: 'Weekly Mowing',
        unitPrice: 4500,
        unitType: 'per_visit',
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/services',
      payload: {
        categoryId: category.id,
        name: 'Weekly Mowing',
        unitPrice: 5000,
        unitType: 'flat',
      },
    });

    expect(res.statusCode).toBe(409);
  });
});

describe('GET /v1/services', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('lists services with optional categoryId filter', async () => {
    const { app, category } = await createTenantCategoryAndGetApp();

    // Create another category
    const cat2Res = await app.inject({
      method: 'POST',
      url: '/v1/services/categories',
      payload: { name: 'Tree Service' },
    });
    const cat2 = cat2Res.json();

    // Add services to each
    await app.inject({
      method: 'POST',
      url: '/v1/services',
      payload: { categoryId: category.id, name: 'Mowing', unitPrice: 4500, unitType: 'per_visit' },
    });
    await app.inject({
      method: 'POST',
      url: '/v1/services',
      payload: { categoryId: cat2.id, name: 'Trimming', unitPrice: 8500, unitType: 'hourly' },
    });

    // List all
    const allRes = await app.inject({ method: 'GET', url: '/v1/services' });
    expect(allRes.json()).toHaveLength(2);

    // Filter by category
    const filteredRes = await app.inject({
      method: 'GET',
      url: `/v1/services?categoryId=${category.id}`,
    });
    expect(filteredRes.json()).toHaveLength(1);
    expect(filteredRes.json()[0].name).toBe('Mowing');
  });
});

describe('PUT /v1/services/:id', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('updates a service item', async () => {
    const { app, category } = await createTenantCategoryAndGetApp();

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/services',
      payload: { categoryId: category.id, name: 'Mowing', unitPrice: 4500, unitType: 'per_visit' },
    });
    const svcId = createRes.json().id;

    const updateRes = await app.inject({
      method: 'PUT',
      url: `/v1/services/${svcId}`,
      payload: { unitPrice: 5500, name: 'Premium Mowing' },
    });

    expect(updateRes.statusCode).toBe(200);
    const body = updateRes.json();
    expect(body.unitPrice).toBe(5500);
    expect(body.name).toBe('Premium Mowing');
  });
});

describe('DELETE /v1/services/:id', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('deactivates service and returns 204', async () => {
    const { app, category } = await createTenantCategoryAndGetApp();

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/services',
      payload: { categoryId: category.id, name: 'Mowing', unitPrice: 4500, unitType: 'per_visit' },
    });
    const svcId = createRes.json().id;

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/v1/services/${svcId}`,
    });
    expect(deleteRes.statusCode).toBe(204);

    // Verify hidden from active list
    const listRes = await app.inject({ method: 'GET', url: '/v1/services' });
    expect(listRes.json()).toHaveLength(0);
  });
});
