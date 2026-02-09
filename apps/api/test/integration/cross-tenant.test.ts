import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, truncateAll, getPool } from './setup.js';

afterAll(async () => {
  await getPool().end();
});

describe('Cross-tenant isolation', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('Tenant B context cannot see Tenant A via GET /v1/tenants/me', async () => {
    const app = await buildTestApp();

    // Create Tenant A
    const resA = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: {
        businessName: 'Tenant A',
        ownerEmail: 'a@test.com',
        ownerFullName: 'Owner A',
      },
    });
    const tenantA = resA.json();

    // Create Tenant B
    const resB = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: {
        businessName: 'Tenant B',
        ownerEmail: 'b@test.com',
        ownerFullName: 'Owner B',
      },
    });
    const tenantB = resB.json();

    // Build app with Tenant B auth context
    const appB = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenantB.tenant.id,
      DEV_AUTH_USER_ID: tenantB.user.id,
    });

    // GET /v1/tenants/me should return Tenant B, not Tenant A
    const meRes = await appB.inject({
      method: 'GET',
      url: '/v1/tenants/me',
    });

    expect(meRes.statusCode).toBe(200);
    const body = meRes.json();
    expect(body.id).toBe(tenantB.tenant.id);
    expect(body.name).toBe('Tenant B');
    expect(body.id).not.toBe(tenantA.tenant.id);
  });

  it('Tenant B cannot see Tenant A business settings via GET', async () => {
    const app = await buildTestApp();

    // Create Tenant A
    const resA = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: {
        businessName: 'Tenant A Settings',
        ownerEmail: 'a-settings@test.com',
        ownerFullName: 'Owner A',
      },
    });
    const tenantA = resA.json();

    // Create Tenant B
    const resB = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: {
        businessName: 'Tenant B Settings',
        ownerEmail: 'b-settings@test.com',
        ownerFullName: 'Owner B',
      },
    });
    const tenantB = resB.json();

    // Tenant A saves settings
    const appA = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenantA.tenant.id,
      DEV_AUTH_USER_ID: tenantA.user.id,
    });
    await appA.inject({
      method: 'PUT',
      url: '/v1/tenants/me/settings',
      payload: {
        phone: '(555) 111-1111',
        addressLine1: null,
        addressLine2: null,
        city: null,
        state: null,
        zip: null,
        timezone: null,
        businessHours: null,
        serviceArea: null,
        defaultDurationMinutes: null,
        description: null,
      },
    });

    // Tenant B should see null (no settings for their tenant)
    const appB = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenantB.tenant.id,
      DEV_AUTH_USER_ID: tenantB.user.id,
    });
    const getRes = await appB.inject({
      method: 'GET',
      url: '/v1/tenants/me/settings',
    });

    expect(getRes.statusCode).toBe(200);
    expect(getRes.json()).toBeNull();
  });

  it('Tenant B PUT does not overwrite Tenant A settings', async () => {
    const app = await buildTestApp();

    // Create Tenant A
    const resA = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: {
        businessName: 'Tenant A Overwrite',
        ownerEmail: 'a-overwrite@test.com',
        ownerFullName: 'Owner A',
      },
    });
    const tenantA = resA.json();

    // Create Tenant B
    const resB = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: {
        businessName: 'Tenant B Overwrite',
        ownerEmail: 'b-overwrite@test.com',
        ownerFullName: 'Owner B',
      },
    });
    const tenantB = resB.json();

    // Tenant A saves settings
    const appA = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenantA.tenant.id,
      DEV_AUTH_USER_ID: tenantA.user.id,
    });
    await appA.inject({
      method: 'PUT',
      url: '/v1/tenants/me/settings',
      payload: {
        phone: '(555) 111-1111',
        addressLine1: null,
        addressLine2: null,
        city: null,
        state: null,
        zip: null,
        timezone: null,
        businessHours: null,
        serviceArea: null,
        defaultDurationMinutes: null,
        description: null,
      },
    });

    // Tenant B saves their own settings
    const appB = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenantB.tenant.id,
      DEV_AUTH_USER_ID: tenantB.user.id,
    });
    await appB.inject({
      method: 'PUT',
      url: '/v1/tenants/me/settings',
      payload: {
        phone: '(555) 222-2222',
        addressLine1: null,
        addressLine2: null,
        city: null,
        state: null,
        zip: null,
        timezone: null,
        businessHours: null,
        serviceArea: null,
        defaultDurationMinutes: null,
        description: null,
      },
    });

    // Verify Tenant A settings unchanged
    const getResA = await appA.inject({
      method: 'GET',
      url: '/v1/tenants/me/settings',
    });
    expect(getResA.json().phone).toBe('(555) 111-1111');

    // Verify Tenant B has their own settings
    const getResB = await appB.inject({
      method: 'GET',
      url: '/v1/tenants/me/settings',
    });
    expect(getResB.json().phone).toBe('(555) 222-2222');
  });

  it('Tenant B cannot list Tenant A service categories', async () => {
    const app = await buildTestApp();

    // Create Tenant A
    const resA = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: { businessName: 'Tenant A Categories', ownerEmail: 'a-cat@test.com', ownerFullName: 'Owner A' },
    });
    const tenantA = resA.json();

    // Create Tenant B
    const resB = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: { businessName: 'Tenant B Categories', ownerEmail: 'b-cat@test.com', ownerFullName: 'Owner B' },
    });
    const tenantB = resB.json();

    // Tenant A creates a category
    const appA = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenantA.tenant.id,
      DEV_AUTH_USER_ID: tenantA.user.id,
    });
    await appA.inject({
      method: 'POST',
      url: '/v1/services/categories',
      payload: { name: 'Lawn Care' },
    });

    // Tenant B should see empty list
    const appB = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenantB.tenant.id,
      DEV_AUTH_USER_ID: tenantB.user.id,
    });
    const listRes = await appB.inject({
      method: 'GET',
      url: '/v1/services/categories',
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json()).toHaveLength(0);
  });

  it('Tenant B cannot update Tenant A service category', async () => {
    const app = await buildTestApp();

    const resA = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: { businessName: 'Tenant A Cat Update', ownerEmail: 'a-cat-u@test.com', ownerFullName: 'Owner A' },
    });
    const tenantA = resA.json();

    const resB = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: { businessName: 'Tenant B Cat Update', ownerEmail: 'b-cat-u@test.com', ownerFullName: 'Owner B' },
    });
    const tenantB = resB.json();

    // Tenant A creates a category
    const appA = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenantA.tenant.id,
      DEV_AUTH_USER_ID: tenantA.user.id,
    });
    const catRes = await appA.inject({
      method: 'POST',
      url: '/v1/services/categories',
      payload: { name: 'Lawn Care' },
    });
    const catId = catRes.json().id;

    // Tenant B tries to update it
    const appB = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenantB.tenant.id,
      DEV_AUTH_USER_ID: tenantB.user.id,
    });
    const updateRes = await appB.inject({
      method: 'PUT',
      url: `/v1/services/categories/${catId}`,
      payload: { name: 'Hacked' },
    });
    expect(updateRes.statusCode).toBe(404);
  });

  it('Tenant B cannot list Tenant A service items', async () => {
    const app = await buildTestApp();

    const resA = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: { businessName: 'Tenant A Services', ownerEmail: 'a-svc@test.com', ownerFullName: 'Owner A' },
    });
    const tenantA = resA.json();

    const resB = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: { businessName: 'Tenant B Services', ownerEmail: 'b-svc@test.com', ownerFullName: 'Owner B' },
    });
    const tenantB = resB.json();

    // Tenant A creates category + service
    const appA = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenantA.tenant.id,
      DEV_AUTH_USER_ID: tenantA.user.id,
    });
    const catRes = await appA.inject({
      method: 'POST',
      url: '/v1/services/categories',
      payload: { name: 'Lawn Care' },
    });
    await appA.inject({
      method: 'POST',
      url: '/v1/services',
      payload: { categoryId: catRes.json().id, name: 'Mowing', unitPrice: 4500, unitType: 'flat' },
    });

    // Tenant B should see empty list
    const appB = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenantB.tenant.id,
      DEV_AUTH_USER_ID: tenantB.user.id,
    });
    const listRes = await appB.inject({
      method: 'GET',
      url: '/v1/services',
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json()).toHaveLength(0);
  });

  it('Tenant B cannot deactivate Tenant A service item', async () => {
    const app = await buildTestApp();

    const resA = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: { businessName: 'Tenant A Svc Del', ownerEmail: 'a-svc-d@test.com', ownerFullName: 'Owner A' },
    });
    const tenantA = resA.json();

    const resB = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: { businessName: 'Tenant B Svc Del', ownerEmail: 'b-svc-d@test.com', ownerFullName: 'Owner B' },
    });
    const tenantB = resB.json();

    // Tenant A creates category + service
    const appA = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenantA.tenant.id,
      DEV_AUTH_USER_ID: tenantA.user.id,
    });
    const catRes = await appA.inject({
      method: 'POST',
      url: '/v1/services/categories',
      payload: { name: 'Lawn Care' },
    });
    const svcRes = await appA.inject({
      method: 'POST',
      url: '/v1/services',
      payload: { categoryId: catRes.json().id, name: 'Mowing', unitPrice: 4500, unitType: 'flat' },
    });
    const svcId = svcRes.json().id;

    // Tenant B tries to deactivate
    const appB = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenantB.tenant.id,
      DEV_AUTH_USER_ID: tenantB.user.id,
    });
    const deleteRes = await appB.inject({
      method: 'DELETE',
      url: `/v1/services/${svcId}`,
    });
    expect(deleteRes.statusCode).toBe(404);
  });

  it('Tenant B cannot list Tenant A clients', async () => {
    const app = await buildTestApp();

    const resA = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: { businessName: 'Tenant A Clients', ownerEmail: 'a-cli@test.com', ownerFullName: 'Owner A' },
    });
    const tenantA = resA.json();

    const resB = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: { businessName: 'Tenant B Clients', ownerEmail: 'b-cli@test.com', ownerFullName: 'Owner B' },
    });
    const tenantB = resB.json();

    // Tenant A creates a client
    const appA = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenantA.tenant.id,
      DEV_AUTH_USER_ID: tenantA.user.id,
    });
    await appA.inject({
      method: 'POST',
      url: '/v1/clients',
      payload: { firstName: 'John', lastName: 'Smith' },
    });

    // Tenant B should see empty list
    const appB = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenantB.tenant.id,
      DEV_AUTH_USER_ID: tenantB.user.id,
    });
    const listRes = await appB.inject({
      method: 'GET',
      url: '/v1/clients',
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().data).toHaveLength(0);
  });

  it('Tenant B cannot update Tenant A client', async () => {
    const app = await buildTestApp();

    const resA = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: { businessName: 'Tenant A Cli Update', ownerEmail: 'a-cli-u@test.com', ownerFullName: 'Owner A' },
    });
    const tenantA = resA.json();

    const resB = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: { businessName: 'Tenant B Cli Update', ownerEmail: 'b-cli-u@test.com', ownerFullName: 'Owner B' },
    });
    const tenantB = resB.json();

    const appA = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenantA.tenant.id,
      DEV_AUTH_USER_ID: tenantA.user.id,
    });
    const clientRes = await appA.inject({
      method: 'POST',
      url: '/v1/clients',
      payload: { firstName: 'John', lastName: 'Smith' },
    });
    const clientId = clientRes.json().id;

    const appB = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenantB.tenant.id,
      DEV_AUTH_USER_ID: tenantB.user.id,
    });
    const updateRes = await appB.inject({
      method: 'PUT',
      url: `/v1/clients/${clientId}`,
      payload: { firstName: 'Hacked' },
    });
    expect(updateRes.statusCode).toBe(404);
  });

  it('Tenant B cannot delete Tenant A client', async () => {
    const app = await buildTestApp();

    const resA = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: { businessName: 'Tenant A Cli Del', ownerEmail: 'a-cli-d@test.com', ownerFullName: 'Owner A' },
    });
    const tenantA = resA.json();

    const resB = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: { businessName: 'Tenant B Cli Del', ownerEmail: 'b-cli-d@test.com', ownerFullName: 'Owner B' },
    });
    const tenantB = resB.json();

    const appA = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenantA.tenant.id,
      DEV_AUTH_USER_ID: tenantA.user.id,
    });
    const clientRes = await appA.inject({
      method: 'POST',
      url: '/v1/clients',
      payload: { firstName: 'John', lastName: 'Smith' },
    });
    const clientId = clientRes.json().id;

    const appB = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenantB.tenant.id,
      DEV_AUTH_USER_ID: tenantB.user.id,
    });
    const deleteRes = await appB.inject({
      method: 'DELETE',
      url: `/v1/clients/${clientId}`,
    });
    expect(deleteRes.statusCode).toBe(404);
  });

  it('Tenant B cannot list Tenant A client properties', async () => {
    const app = await buildTestApp();

    const resA = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: { businessName: 'Tenant A Props', ownerEmail: 'a-prop@test.com', ownerFullName: 'Owner A' },
    });
    const tenantA = resA.json();

    const resB = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: { businessName: 'Tenant B Props', ownerEmail: 'b-prop@test.com', ownerFullName: 'Owner B' },
    });
    const tenantB = resB.json();

    const appA = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenantA.tenant.id,
      DEV_AUTH_USER_ID: tenantA.user.id,
    });
    const clientRes = await appA.inject({
      method: 'POST',
      url: '/v1/clients',
      payload: { firstName: 'John', lastName: 'Smith' },
    });
    const clientId = clientRes.json().id;

    await appA.inject({
      method: 'POST',
      url: `/v1/clients/${clientId}/properties`,
      payload: { addressLine1: '123 Main St' },
    });

    const appB = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenantB.tenant.id,
      DEV_AUTH_USER_ID: tenantB.user.id,
    });
    const listRes = await appB.inject({
      method: 'GET',
      url: `/v1/clients/${clientId}/properties`,
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json()).toHaveLength(0);
  });

  it('Tenant B context cannot see Tenant A users via GET /v1/users/me', async () => {
    const app = await buildTestApp();

    // Create Tenant A
    const resA = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: {
        businessName: 'Tenant A Users',
        ownerEmail: 'a@test.com',
        ownerFullName: 'Owner A',
      },
    });
    const tenantA = resA.json();

    // Create Tenant B
    const resB = await app.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: {
        businessName: 'Tenant B Users',
        ownerEmail: 'b@test.com',
        ownerFullName: 'Owner B',
      },
    });
    const tenantB = resB.json();

    // Try to access Tenant A's user with Tenant B's context
    const appCrossTenant = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenantB.tenant.id,
      DEV_AUTH_USER_ID: tenantA.user.id, // Tenant A's user ID
    });

    const meRes = await appCrossTenant.inject({
      method: 'GET',
      url: '/v1/users/me',
    });

    // Should 404 because user belongs to Tenant A, not Tenant B
    expect(meRes.statusCode).toBe(404);
  });
});
