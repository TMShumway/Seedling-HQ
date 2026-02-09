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
      businessName: 'Timeline Test Biz',
      ownerEmail: 'timeline-test@test.com',
      ownerFullName: 'Timeline Owner',
    },
  });
  const created = createRes.json();

  const authedApp = await buildTestApp({
    DEV_AUTH_TENANT_ID: created.tenant.id,
    DEV_AUTH_USER_ID: created.user.id,
  });

  return { app: authedApp, tenant: created.tenant, user: created.user };
}

describe('GET /v1/clients/:clientId/timeline', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it('returns 404 for non-existent client', async () => {
    const { app } = await createTenantAndGetApp();

    const res = await app.inject({
      method: 'GET',
      url: '/v1/clients/00000000-0000-0000-0000-000000000999/timeline',
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns timeline events for client and properties newest-first', async () => {
    const { app } = await createTenantAndGetApp();

    // Create a client (generates client.created audit event)
    const clientRes = await app.inject({
      method: 'POST',
      url: '/v1/clients',
      payload: { firstName: 'John', lastName: 'Doe', email: 'john@test.com' },
    });
    const client = clientRes.json();

    // Update client (generates client.updated audit event)
    await app.inject({
      method: 'PUT',
      url: `/v1/clients/${client.id}`,
      payload: { firstName: 'Johnny' },
    });

    // Add a property (generates property.created audit event)
    await app.inject({
      method: 'POST',
      url: `/v1/clients/${client.id}/properties`,
      payload: { addressLine1: '123 Main St' },
    });

    // Get timeline
    const res = await app.inject({
      method: 'GET',
      url: `/v1/clients/${client.id}/timeline`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.length).toBe(3);
    expect(body.hasMore).toBe(false);

    // Newest first
    expect(body.data[0].eventName).toBe('property.created');
    expect(body.data[0].label).toBe('Property added');
    expect(body.data[1].eventName).toBe('client.updated');
    expect(body.data[1].label).toBe('Client updated');
    expect(body.data[2].eventName).toBe('client.created');
    expect(body.data[2].label).toBe('Client created');

    // All events have expected fields
    for (const event of body.data) {
      expect(event.id).toBeDefined();
      expect(event.createdAt).toBeDefined();
      expect(event.principalId).toBeDefined();
      expect(event.subjectType).toBeDefined();
      expect(event.subjectId).toBeDefined();
    }
  });

  it('supports pagination with cursor', async () => {
    const { app } = await createTenantAndGetApp();

    // Create client + 2 properties = 3 audit events
    const clientRes = await app.inject({
      method: 'POST',
      url: '/v1/clients',
      payload: { firstName: 'Page', lastName: 'Test' },
    });
    const client = clientRes.json();

    await app.inject({
      method: 'POST',
      url: `/v1/clients/${client.id}/properties`,
      payload: { addressLine1: '111 First St' },
    });
    await app.inject({
      method: 'POST',
      url: `/v1/clients/${client.id}/properties`,
      payload: { addressLine1: '222 Second St' },
    });

    // Page 1: limit=2
    const page1 = await app.inject({
      method: 'GET',
      url: `/v1/clients/${client.id}/timeline?limit=2`,
    });
    const body1 = page1.json();
    expect(body1.data).toHaveLength(2);
    expect(body1.hasMore).toBe(true);
    expect(body1.cursor).toBeDefined();

    // Page 2: use cursor
    const page2 = await app.inject({
      method: 'GET',
      url: `/v1/clients/${client.id}/timeline?limit=2&cursor=${body1.cursor}`,
    });
    const body2 = page2.json();
    expect(body2.data).toHaveLength(1);
    expect(body2.hasMore).toBe(false);
    expect(body2.cursor).toBeNull();
  });

  it('excludes deactivation events when exclude=deactivated', async () => {
    const { app } = await createTenantAndGetApp();

    // Create client + property, then deactivate property
    const clientRes = await app.inject({
      method: 'POST',
      url: '/v1/clients',
      payload: { firstName: 'Filter', lastName: 'Test' },
    });
    const client = clientRes.json();

    const propRes = await app.inject({
      method: 'POST',
      url: `/v1/clients/${client.id}/properties`,
      payload: { addressLine1: '999 Delete St' },
    });
    const property = propRes.json();

    await app.inject({
      method: 'DELETE',
      url: `/v1/properties/${property.id}`,
    });

    // Without filter: should include deactivation event
    const allRes = await app.inject({
      method: 'GET',
      url: `/v1/clients/${client.id}/timeline`,
    });
    const allBody = allRes.json();
    const allEvents = allBody.data.map((e: { eventName: string }) => e.eventName);
    expect(allEvents).toContain('property.deactivated');

    // With filter: should exclude deactivation events
    const filteredRes = await app.inject({
      method: 'GET',
      url: `/v1/clients/${client.id}/timeline?exclude=deactivated`,
    });
    const filteredBody = filteredRes.json();
    const filteredEvents = filteredBody.data.map((e: { eventName: string }) => e.eventName);
    expect(filteredEvents).not.toContain('property.deactivated');
    expect(filteredEvents).not.toContain('client.deactivated');
  });

  it('enforces cross-tenant isolation', async () => {
    // Create tenant A
    const { app: appA } = await createTenantAndGetApp();

    // Create client in tenant A
    const clientRes = await appA.inject({
      method: 'POST',
      url: '/v1/clients',
      payload: { firstName: 'TenantA', lastName: 'Client' },
    });
    const clientA = clientRes.json();

    // Create tenant B
    const appB = await buildTestApp();
    const tenantBRes = await appB.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: {
        businessName: 'Tenant B Biz',
        ownerEmail: 'tenantb@test.com',
        ownerFullName: 'Tenant B Owner',
      },
    });
    const tenantB = tenantBRes.json();
    const authedAppB = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenantB.tenant.id,
      DEV_AUTH_USER_ID: tenantB.user.id,
    });

    // Tenant B tries to access tenant A's client timeline → 404
    const res = await authedAppB.inject({
      method: 'GET',
      url: `/v1/clients/${clientA.id}/timeline`,
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns empty timeline for client with no events beyond creation', async () => {
    const { app } = await createTenantAndGetApp();

    const clientRes = await app.inject({
      method: 'POST',
      url: '/v1/clients',
      payload: { firstName: 'Empty', lastName: 'Timeline' },
    });
    const client = clientRes.json();

    const res = await app.inject({
      method: 'GET',
      url: `/v1/clients/${client.id}/timeline`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Should have at least the client.created event
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data[0].eventName).toBe('client.created');
  });
});
