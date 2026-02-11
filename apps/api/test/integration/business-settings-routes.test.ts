import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, truncateAll, getPool } from './setup.js';

afterAll(async () => {
  await getPool().end();
});

const validSettings = {
  phone: '(555) 123-4567',
  addressLine1: '123 Main St',
  addressLine2: null,
  city: 'Springfield',
  state: 'IL',
  zip: '62701',
  timezone: 'America/Chicago',
  businessHours: {
    monday: { open: '08:00', close: '17:00', closed: false },
    tuesday: { open: '08:00', close: '17:00', closed: false },
    wednesday: { open: '08:00', close: '17:00', closed: false },
    thursday: { open: '08:00', close: '17:00', closed: false },
    friday: { open: '08:00', close: '17:00', closed: false },
    saturday: { open: '09:00', close: '13:00', closed: false },
    sunday: { open: null, close: null, closed: true },
  },
  serviceArea: 'Springfield and surrounding areas',
  defaultDurationMinutes: 60,
  description: 'A test landscaping business.',
};

async function createTenantAndGetApp() {
  const app = await buildTestApp();

  // Create a tenant first
  const createRes = await app.inject({
    method: 'POST',
    url: '/v1/tenants',
    payload: {
      businessName: 'Settings Test Biz',
      ownerEmail: 'settings@test.com',
      ownerFullName: 'Settings Owner',
      ownerPassword: 'test-password',
    },
  });
  const created = createRes.json();

  // Build app with the new tenant's auth context
  const authedApp = await buildTestApp({
    DEV_AUTH_TENANT_ID: created.tenant.id,
    DEV_AUTH_USER_ID: created.user.id,
  });

  return { app: authedApp, tenant: created.tenant, user: created.user };
}

describe('GET /v1/tenants/me/settings', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('returns null when no settings exist', async () => {
    const { app } = await createTenantAndGetApp();

    const res = await app.inject({
      method: 'GET',
      url: '/v1/tenants/me/settings',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toBeNull();
  });
});

describe('PUT /v1/tenants/me/settings', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('creates settings and returns 200', async () => {
    const { app, tenant } = await createTenantAndGetApp();

    const res = await app.inject({
      method: 'PUT',
      url: '/v1/tenants/me/settings',
      payload: validSettings,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.tenantId).toBe(tenant.id);
    expect(body.phone).toBe('(555) 123-4567');
    expect(body.city).toBe('Springfield');
    expect(body.timezone).toBe('America/Chicago');
    expect(body.defaultDurationMinutes).toBe(60);
    expect(body.businessHours.monday.open).toBe('08:00');
    expect(body.businessHours.sunday.closed).toBe(true);
    expect(body.id).toBeDefined();
    expect(body.createdAt).toBeDefined();
    expect(body.updatedAt).toBeDefined();
  });

  it('round-trips settings via GET after PUT', async () => {
    const { app } = await createTenantAndGetApp();

    await app.inject({
      method: 'PUT',
      url: '/v1/tenants/me/settings',
      payload: validSettings,
    });

    const getRes = await app.inject({
      method: 'GET',
      url: '/v1/tenants/me/settings',
    });

    expect(getRes.statusCode).toBe(200);
    const body = getRes.json();
    expect(body.phone).toBe('(555) 123-4567');
    expect(body.businessHours.friday.close).toBe('17:00');
    expect(body.serviceArea).toBe('Springfield and surrounding areas');
  });

  it('upserts on second PUT (preserves id, updates data)', async () => {
    const { app } = await createTenantAndGetApp();

    const firstRes = await app.inject({
      method: 'PUT',
      url: '/v1/tenants/me/settings',
      payload: validSettings,
    });
    const firstBody = firstRes.json();

    const updatedSettings = { ...validSettings, phone: '(555) 999-0000', city: 'Chicago' };
    const secondRes = await app.inject({
      method: 'PUT',
      url: '/v1/tenants/me/settings',
      payload: updatedSettings,
    });

    expect(secondRes.statusCode).toBe(200);
    const secondBody = secondRes.json();
    expect(secondBody.id).toBe(firstBody.id); // Same id preserved
    expect(secondBody.phone).toBe('(555) 999-0000');
    expect(secondBody.city).toBe('Chicago');
  });

  it('returns 400 for invalid body', async () => {
    const { app } = await createTenantAndGetApp();

    const res = await app.inject({
      method: 'PUT',
      url: '/v1/tenants/me/settings',
      payload: { phone: 123, city: true }, // wrong types
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for defaultDurationMinutes < 15', async () => {
    const { app } = await createTenantAndGetApp();

    const res = await app.inject({
      method: 'PUT',
      url: '/v1/tenants/me/settings',
      payload: { ...validSettings, defaultDurationMinutes: 5 },
    });

    expect(res.statusCode).toBe(400);
  });

  it('businessHours JSONB round-trips correctly', async () => {
    const { app } = await createTenantAndGetApp();

    const customHours = {
      ...validSettings,
      businessHours: {
        monday: { open: '07:00', close: '19:00', closed: false },
        tuesday: { open: null, close: null, closed: true },
        wednesday: { open: '10:00', close: '14:00', closed: false },
        thursday: { open: '08:00', close: '17:00', closed: false },
        friday: { open: '08:00', close: '12:00', closed: false },
        saturday: { open: null, close: null, closed: true },
        sunday: { open: null, close: null, closed: true },
      },
    };

    await app.inject({
      method: 'PUT',
      url: '/v1/tenants/me/settings',
      payload: customHours,
    });

    const getRes = await app.inject({
      method: 'GET',
      url: '/v1/tenants/me/settings',
    });

    const body = getRes.json();
    expect(body.businessHours.monday.open).toBe('07:00');
    expect(body.businessHours.monday.close).toBe('19:00');
    expect(body.businessHours.tuesday.closed).toBe(true);
    expect(body.businessHours.tuesday.open).toBeNull();
    expect(body.businessHours.wednesday.open).toBe('10:00');
    expect(body.businessHours.saturday.closed).toBe(true);
  });
});
