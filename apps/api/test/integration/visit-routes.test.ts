import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, truncateAll, getPool, getDb } from './setup.js';
import { resetRateLimitStore } from '../../src/adapters/http/middleware/rate-limit.js';
import { quotes, users } from '../../src/infra/db/schema.js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../../src/shared/password.js';

afterAll(async () => {
  await getPool().end();
});

async function createTenantAndGetApp() {
  const app = await buildTestApp();

  const createRes = await app.inject({
    method: 'POST',
    url: '/v1/tenants',
    payload: {
      businessName: 'Visit Test Biz',
      ownerEmail: 'visit-test@test.com',
      ownerFullName: 'Visit Owner',
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

async function createJobWithVisit(app: ReturnType<typeof buildTestApp> extends Promise<infer T> ? T : never) {
  const { client, property } = await createClientWithProperty(app);

  // Create standalone quote
  const quoteRes = await app.inject({
    method: 'POST',
    url: '/v1/quotes',
    payload: {
      clientId: client.id,
      propertyId: property.id,
      title: 'Test Visit Quote',
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
      ],
    },
  });

  // Directly set status to approved
  const db = getDb();
  await db.update(quotes).set({
    status: 'approved',
    sentAt: new Date(),
    approvedAt: new Date(),
  }).where(eq(quotes.id, quote.id));

  // Create job (which creates visit)
  const jobRes = await app.inject({
    method: 'POST',
    url: '/v1/jobs',
    payload: { quoteId: quote.id },
  });
  const jobBody = jobRes.json();

  return { client, property, job: jobBody.job, visit: jobBody.visit, quoteId: quote.id };
}

describe('PATCH /v1/visits/:id/schedule', () => {
  beforeEach(async () => {
    await truncateAll();
    resetRateLimitStore();
  });

  it('schedules a visit with start only (auto-computed end)', async () => {
    const { app } = await createTenantAndGetApp();
    const { visit } = await createJobWithVisit(app);

    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/visits/${visit.id}/schedule`,
      payload: { scheduledStart: '2026-02-15T09:00:00Z' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.visit.scheduledStart).toBe('2026-02-15T09:00:00.000Z');
    expect(body.visit.scheduledEnd).toBe('2026-02-15T10:00:00.000Z'); // +60 min default
  });

  it('schedules a visit with start + end', async () => {
    const { app } = await createTenantAndGetApp();
    const { visit } = await createJobWithVisit(app);

    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/visits/${visit.id}/schedule`,
      payload: {
        scheduledStart: '2026-02-15T09:00:00Z',
        scheduledEnd: '2026-02-15T12:00:00Z',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.visit.scheduledStart).toBe('2026-02-15T09:00:00.000Z');
    expect(body.visit.scheduledEnd).toBe('2026-02-15T12:00:00.000Z');
  });

  it('reschedules a previously scheduled visit', async () => {
    const { app } = await createTenantAndGetApp();
    const { visit } = await createJobWithVisit(app);

    // First schedule
    await app.inject({
      method: 'PATCH',
      url: `/v1/visits/${visit.id}/schedule`,
      payload: { scheduledStart: '2026-02-15T09:00:00Z' },
    });

    // Reschedule
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/visits/${visit.id}/schedule`,
      payload: { scheduledStart: '2026-02-16T14:00:00Z' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.visit.scheduledStart).toBe('2026-02-16T14:00:00.000Z');
  });

  it('returns 400 when end is before start', async () => {
    const { app } = await createTenantAndGetApp();
    const { visit } = await createJobWithVisit(app);

    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/visits/${visit.id}/schedule`,
      payload: {
        scheduledStart: '2026-02-15T10:00:00Z',
        scheduledEnd: '2026-02-15T09:00:00Z',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for non-existent visit', async () => {
    const { app } = await createTenantAndGetApp();

    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/visits/00000000-0000-0000-0000-000000000999/schedule',
      payload: { scheduledStart: '2026-02-15T09:00:00Z' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('enforces tenant isolation on schedule', async () => {
    const { app: appA } = await createTenantAndGetApp();
    const { visit } = await createJobWithVisit(appA);

    // Create tenant B
    const publicApp = await buildTestApp();
    const createBRes = await publicApp.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: {
        businessName: 'Tenant B Biz',
        ownerEmail: 'b-visit@test.com',
        ownerFullName: 'Owner B',
        ownerPassword: 'test-password',
      },
    });
    const tenantB = createBRes.json();

    const appB = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenantB.tenant.id,
      DEV_AUTH_USER_ID: tenantB.user.id,
    });

    // Tenant B cannot schedule tenant A's visit
    const res = await appB.inject({
      method: 'PATCH',
      url: `/v1/visits/${visit.id}/schedule`,
      payload: { scheduledStart: '2026-02-15T09:00:00Z' },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('GET /v1/visits', () => {
  beforeEach(async () => {
    await truncateAll();
    resetRateLimitStore();
  });

  it('returns scheduled visits within date range', async () => {
    const { app } = await createTenantAndGetApp();
    const { visit } = await createJobWithVisit(app);

    // Schedule the visit for Feb 15
    await app.inject({
      method: 'PATCH',
      url: `/v1/visits/${visit.id}/schedule`,
      payload: { scheduledStart: '2026-02-15T09:00:00Z' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/visits?from=2026-02-14T00:00:00Z&to=2026-02-16T00:00:00Z',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(visit.id);
  });

  it('excludes visits outside date range', async () => {
    const { app } = await createTenantAndGetApp();
    const { visit } = await createJobWithVisit(app);

    // Schedule the visit for Feb 15
    await app.inject({
      method: 'PATCH',
      url: `/v1/visits/${visit.id}/schedule`,
      payload: { scheduledStart: '2026-02-15T09:00:00Z' },
    });

    // Query a different range
    const res = await app.inject({
      method: 'GET',
      url: '/v1/visits?from=2026-02-20T00:00:00Z&to=2026-02-27T00:00:00Z',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(0);
  });

  it('includes context fields (jobTitle, clientName, propertyAddress)', async () => {
    const { app } = await createTenantAndGetApp();
    const { visit } = await createJobWithVisit(app);

    await app.inject({
      method: 'PATCH',
      url: `/v1/visits/${visit.id}/schedule`,
      payload: { scheduledStart: '2026-02-15T09:00:00Z' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/visits?from=2026-02-14T00:00:00Z&to=2026-02-16T00:00:00Z',
    });

    const data = res.json().data[0];
    expect(data.jobTitle).toBe('Test Visit Quote');
    expect(data.clientName).toBe('Jane Doe');
    expect(data.propertyAddress).toBe('456 Oak Ave');
  });

  it('returns 400 when from >= to', async () => {
    const { app } = await createTenantAndGetApp();

    const res = await app.inject({
      method: 'GET',
      url: '/v1/visits?from=2026-02-16T00:00:00Z&to=2026-02-15T00:00:00Z',
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when range exceeds 8 days', async () => {
    const { app } = await createTenantAndGetApp();

    const res = await app.inject({
      method: 'GET',
      url: '/v1/visits?from=2026-02-01T00:00:00Z&to=2026-02-20T00:00:00Z',
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('allows exactly 8-day range', async () => {
    const { app } = await createTenantAndGetApp();

    const res = await app.inject({
      method: 'GET',
      url: '/v1/visits?from=2026-02-09T00:00:00Z&to=2026-02-17T00:00:00Z',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(0);
  });
});

describe('GET /v1/visits/unscheduled', () => {
  beforeEach(async () => {
    await truncateAll();
    resetRateLimitStore();
  });

  it('returns unscheduled visits', async () => {
    const { app } = await createTenantAndGetApp();
    const { visit } = await createJobWithVisit(app);

    // The visit starts as unscheduled (scheduledStart = null)
    const res = await app.inject({
      method: 'GET',
      url: '/v1/visits/unscheduled',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(visit.id);
    expect(body.data[0].scheduledStart).toBeNull();
    expect(body.data[0].jobTitle).toBe('Test Visit Quote');
    expect(body.data[0].clientName).toBe('Jane Doe');
  });

  it('does not return scheduled visits', async () => {
    const { app } = await createTenantAndGetApp();
    const { visit } = await createJobWithVisit(app);

    // Schedule the visit
    await app.inject({
      method: 'PATCH',
      url: `/v1/visits/${visit.id}/schedule`,
      payload: { scheduledStart: '2026-02-15T09:00:00Z' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/visits/unscheduled',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(0);
  });

  it('enforces tenant isolation on unscheduled', async () => {
    const { app: appA } = await createTenantAndGetApp();
    await createJobWithVisit(appA);

    // Create tenant B
    const publicApp = await buildTestApp();
    const createBRes = await publicApp.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: {
        businessName: 'Tenant B Biz',
        ownerEmail: 'b-visit-unsched@test.com',
        ownerFullName: 'Owner B',
        ownerPassword: 'test-password',
      },
    });
    const tenantB = createBRes.json();

    const appB = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenantB.tenant.id,
      DEV_AUTH_USER_ID: tenantB.user.id,
    });

    // Tenant B sees no unscheduled visits
    const res = await appB.inject({
      method: 'GET',
      url: '/v1/visits/unscheduled',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(0);
  });
});

async function createMemberUser(tenantId: string): Promise<{ id: string }> {
  const db = getDb();
  const memberId = randomUUID();
  const pwHash = await hashPassword('test-password');
  await db.insert(users).values({
    id: memberId,
    tenantId,
    email: `member-${memberId.slice(0, 8)}@test.com`,
    fullName: 'Test Member',
    role: 'member',
    passwordHash: pwHash,
    status: 'active',
  });
  return { id: memberId };
}

describe('PATCH /v1/visits/:id/assign', () => {
  beforeEach(async () => {
    await truncateAll();
    resetRateLimitStore();
  });

  it('assigns a user to a visit (owner)', async () => {
    const { app, tenant, user } = await createTenantAndGetApp();
    const { visit } = await createJobWithVisit(app);

    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/visits/${visit.id}/assign`,
      payload: { assignedUserId: user.id },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.visit.assignedUserId).toBe(user.id);
  });

  it('unassigns a user from a visit', async () => {
    const { app, user } = await createTenantAndGetApp();
    const { visit } = await createJobWithVisit(app);

    // First assign
    await app.inject({
      method: 'PATCH',
      url: `/v1/visits/${visit.id}/assign`,
      payload: { assignedUserId: user.id },
    });

    // Then unassign
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/visits/${visit.id}/assign`,
      payload: { assignedUserId: null },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().visit.assignedUserId).toBeNull();
  });

  it('reassigns from one user to another', async () => {
    const { app, tenant, user } = await createTenantAndGetApp();
    const { visit } = await createJobWithVisit(app);
    const member = await createMemberUser(tenant.id);

    // Assign to owner
    await app.inject({
      method: 'PATCH',
      url: `/v1/visits/${visit.id}/assign`,
      payload: { assignedUserId: user.id },
    });

    // Reassign to member
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/visits/${visit.id}/assign`,
      payload: { assignedUserId: member.id },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().visit.assignedUserId).toBe(member.id);
  });

  it('returns 403 when caller is member', async () => {
    const { app: ownerApp, tenant } = await createTenantAndGetApp();
    const { visit } = await createJobWithVisit(ownerApp);
    const member = await createMemberUser(tenant.id);

    // Auth as member
    const memberApp = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenant.id,
      DEV_AUTH_USER_ID: member.id,
      DEV_AUTH_ROLE: 'member',
    });

    const res = await memberApp.inject({
      method: 'PATCH',
      url: `/v1/visits/${visit.id}/assign`,
      payload: { assignedUserId: member.id },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('returns 404 for non-existent visit', async () => {
    const { app } = await createTenantAndGetApp();

    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/visits/00000000-0000-0000-0000-000000000999/assign',
      payload: { assignedUserId: '00000000-0000-0000-0000-000000000010' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 404 for non-existent user', async () => {
    const { app } = await createTenantAndGetApp();
    const { visit } = await createJobWithVisit(app);

    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/visits/${visit.id}/assign`,
      payload: { assignedUserId: '00000000-0000-0000-0000-000000000999' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 400 for inactive user', async () => {
    const { app, tenant } = await createTenantAndGetApp();
    const { visit } = await createJobWithVisit(app);
    const member = await createMemberUser(tenant.id);

    // Disable the member
    const db = getDb();
    await db.update(users).set({ status: 'disabled' }).where(eq(users.id, member.id));

    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/visits/${visit.id}/assign`,
      payload: { assignedUserId: member.id },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('enforces tenant isolation on assign', async () => {
    const { app: appA } = await createTenantAndGetApp();
    const { visit } = await createJobWithVisit(appA);

    // Create tenant B
    const publicApp = await buildTestApp();
    const createBRes = await publicApp.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: {
        businessName: 'Tenant B Assign',
        ownerEmail: 'b-assign@test.com',
        ownerFullName: 'Owner B',
        ownerPassword: 'test-password',
      },
    });
    const tenantB = createBRes.json();

    const appB = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenantB.tenant.id,
      DEV_AUTH_USER_ID: tenantB.user.id,
    });

    // Tenant B cannot assign to Tenant A's visit
    const res = await appB.inject({
      method: 'PATCH',
      url: `/v1/visits/${visit.id}/assign`,
      payload: { assignedUserId: tenantB.user.id },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('GET /v1/visits with assignedUserId filter', () => {
  beforeEach(async () => {
    await truncateAll();
    resetRateLimitStore();
  });

  it('filters visits by assignedUserId', async () => {
    const { app, user } = await createTenantAndGetApp();
    const { visit } = await createJobWithVisit(app);

    // Schedule the visit
    await app.inject({
      method: 'PATCH',
      url: `/v1/visits/${visit.id}/schedule`,
      payload: { scheduledStart: '2026-02-15T09:00:00Z' },
    });

    // Assign
    await app.inject({
      method: 'PATCH',
      url: `/v1/visits/${visit.id}/assign`,
      payload: { assignedUserId: user.id },
    });

    // Filter by assigned user — should find it
    const res = await app.inject({
      method: 'GET',
      url: `/v1/visits?from=2026-02-14T00:00:00Z&to=2026-02-16T00:00:00Z&assignedUserId=${user.id}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(1);
  });

  it('returns empty when assignedUserId does not match', async () => {
    const { app, user } = await createTenantAndGetApp();
    const { visit } = await createJobWithVisit(app);

    // Schedule + assign
    await app.inject({
      method: 'PATCH',
      url: `/v1/visits/${visit.id}/schedule`,
      payload: { scheduledStart: '2026-02-15T09:00:00Z' },
    });
    await app.inject({
      method: 'PATCH',
      url: `/v1/visits/${visit.id}/assign`,
      payload: { assignedUserId: user.id },
    });

    // Filter by different user
    const res = await app.inject({
      method: 'GET',
      url: '/v1/visits?from=2026-02-14T00:00:00Z&to=2026-02-16T00:00:00Z&assignedUserId=00000000-0000-0000-0000-000000000099',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(0);
  });

  it('includes assignedUserName in response', async () => {
    const { app, user } = await createTenantAndGetApp();
    const { visit } = await createJobWithVisit(app);

    // Schedule + assign
    await app.inject({
      method: 'PATCH',
      url: `/v1/visits/${visit.id}/schedule`,
      payload: { scheduledStart: '2026-02-15T09:00:00Z' },
    });
    await app.inject({
      method: 'PATCH',
      url: `/v1/visits/${visit.id}/assign`,
      payload: { assignedUserId: user.id },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/visits?from=2026-02-14T00:00:00Z&to=2026-02-16T00:00:00Z',
    });

    expect(res.statusCode).toBe(200);
    const data = res.json().data[0];
    expect(data.assignedUserName).toBe('Visit Owner');
  });

  it('returns null assignedUserName when unassigned', async () => {
    const { app } = await createTenantAndGetApp();
    const { visit } = await createJobWithVisit(app);

    // Schedule but don't assign
    await app.inject({
      method: 'PATCH',
      url: `/v1/visits/${visit.id}/schedule`,
      payload: { scheduledStart: '2026-02-15T09:00:00Z' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/visits?from=2026-02-14T00:00:00Z&to=2026-02-16T00:00:00Z',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data[0].assignedUserName).toBeNull();
  });
});

describe('GET /v1/visits/unscheduled with assignedUserId filter', () => {
  beforeEach(async () => {
    await truncateAll();
    resetRateLimitStore();
  });

  it('filters unscheduled visits by assignedUserId', async () => {
    const { app, user } = await createTenantAndGetApp();
    const { visit } = await createJobWithVisit(app);

    // Assign but don't schedule
    await app.inject({
      method: 'PATCH',
      url: `/v1/visits/${visit.id}/assign`,
      payload: { assignedUserId: user.id },
    });

    // Filter by assigned user
    const res = await app.inject({
      method: 'GET',
      url: `/v1/visits/unscheduled?assignedUserId=${user.id}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(1);
  });

  it('returns empty when no unscheduled visits match assignedUserId', async () => {
    const { app } = await createTenantAndGetApp();
    await createJobWithVisit(app);

    // Unassigned visit — filter by some user
    const res = await app.inject({
      method: 'GET',
      url: '/v1/visits/unscheduled?assignedUserId=00000000-0000-0000-0000-000000000099',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(0);
  });
});
