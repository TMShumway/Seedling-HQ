import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildTestApp, truncateAll, getPool } from './setup.js';
import { resetRateLimitStore } from '../../src/adapters/http/middleware/rate-limit.js';

afterAll(async () => {
  await getPool().end();
});

async function createTenant(businessName: string, email: string, fullName: string) {
  const app = await buildTestApp();
  const res = await app.inject({
    method: 'POST',
    url: '/v1/tenants',
    payload: { businessName, ownerEmail: email, ownerFullName: fullName, ownerPassword: 'test-password' },
  });
  return res.json();
}

describe('GET /v1/users', () => {
  beforeEach(async () => {
    await truncateAll();
    resetRateLimitStore();
  });

  it('returns team list for authenticated user', async () => {
    const { tenant, user } = await createTenant('Team Test', 'owner@test.com', 'Team Owner');

    const app = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenant.id,
      DEV_AUTH_USER_ID: user.id,
      DEV_AUTH_ROLE: 'owner',
    });
    const res = await app.inject({ method: 'GET', url: '/v1/users' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.users).toHaveLength(1);
    expect(body.users[0].email).toBe('owner@test.com');
    expect(body.users[0].role).toBe('owner');
    expect(body.users[0].status).toBe('active');
  });

  it('returns only users for the caller tenant (tenant isolation)', async () => {
    const { tenant: t1, user: u1 } = await createTenant('Biz A', 'owner-a@test.com', 'Owner A');
    await createTenant('Biz B', 'owner-b@test.com', 'Owner B');

    const app = await buildTestApp({
      DEV_AUTH_TENANT_ID: t1.id,
      DEV_AUTH_USER_ID: u1.id,
      DEV_AUTH_ROLE: 'owner',
    });
    const res = await app.inject({ method: 'GET', url: '/v1/users' });

    const body = res.json();
    expect(body.users).toHaveLength(1);
    expect(body.users[0].email).toBe('owner-a@test.com');
  });
});

describe('POST /v1/users', () => {
  beforeEach(async () => {
    await truncateAll();
    resetRateLimitStore();
  });

  it('creates a new member user (local mode)', async () => {
    const { tenant, user } = await createTenant('Create Test', 'owner@test.com', 'Owner');

    const app = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenant.id,
      DEV_AUTH_USER_ID: user.id,
      DEV_AUTH_ROLE: 'owner',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/users',
      payload: {
        email: 'member@test.com',
        fullName: 'New Member',
        role: 'member',
        password: 'test-password',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user.email).toBe('member@test.com');
    expect(body.user.fullName).toBe('New Member');
    expect(body.user.role).toBe('member');
    expect(body.user.status).toBe('active');
    expect(body.user.tenantId).toBe(tenant.id);
  });

  it('creates admin user when caller is owner', async () => {
    const { tenant, user } = await createTenant('Admin Test', 'owner@test.com', 'Owner');

    const app = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenant.id,
      DEV_AUTH_USER_ID: user.id,
      DEV_AUTH_ROLE: 'owner',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/users',
      payload: {
        email: 'admin@test.com',
        fullName: 'New Admin',
        role: 'admin',
        password: 'test-password',
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().user.role).toBe('admin');
  });

  it('returns 403 when member tries to create user', async () => {
    const { tenant, user } = await createTenant('Member Test', 'owner@test.com', 'Owner');

    const app = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenant.id,
      DEV_AUTH_USER_ID: user.id,
      DEV_AUTH_ROLE: 'member',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/users',
      payload: {
        email: 'other@test.com',
        fullName: 'Other User',
        role: 'member',
        password: 'test-password',
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 when admin tries to create admin', async () => {
    const { tenant, user } = await createTenant('Admin Guard', 'owner@test.com', 'Owner');

    const app = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenant.id,
      DEV_AUTH_USER_ID: user.id,
      DEV_AUTH_ROLE: 'admin',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/users',
      payload: {
        email: 'other@test.com',
        fullName: 'Other User',
        role: 'admin',
        password: 'test-password',
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 409 for duplicate email', async () => {
    const { tenant, user } = await createTenant('Dup Test', 'owner@test.com', 'Owner');

    const app = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenant.id,
      DEV_AUTH_USER_ID: user.id,
      DEV_AUTH_ROLE: 'owner',
    });

    // Create first member
    await app.inject({
      method: 'POST',
      url: '/v1/users',
      payload: { email: 'dup@test.com', fullName: 'First', role: 'member', password: 'test-password' },
    });

    // Create second with same email
    const res = await app.inject({
      method: 'POST',
      url: '/v1/users',
      payload: { email: 'dup@test.com', fullName: 'Second', role: 'member', password: 'test-password' },
    });

    expect(res.statusCode).toBe(409);
  });

  it('rejects missing password in local mode (400)', async () => {
    const { tenant, user } = await createTenant('Pass Test', 'owner@test.com', 'Owner');

    const app = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenant.id,
      DEV_AUTH_USER_ID: user.id,
      DEV_AUTH_ROLE: 'owner',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/users',
      payload: { email: 'nopass@test.com', fullName: 'No Pass', role: 'member' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('new user appears in GET /v1/users list', async () => {
    const { tenant, user } = await createTenant('List Test', 'owner@test.com', 'Owner');

    const app = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenant.id,
      DEV_AUTH_USER_ID: user.id,
      DEV_AUTH_ROLE: 'owner',
    });

    await app.inject({
      method: 'POST',
      url: '/v1/users',
      payload: { email: 'listed@test.com', fullName: 'Listed User', role: 'member', password: 'test-password' },
    });

    const listRes = await app.inject({ method: 'GET', url: '/v1/users' });
    const body = listRes.json();
    expect(body.users).toHaveLength(2);
    const emails = body.users.map((u: { email: string }) => u.email);
    expect(emails).toContain('owner@test.com');
    expect(emails).toContain('listed@test.com');
  });
});

describe('POST /v1/users/:id/reset-password', () => {
  beforeEach(async () => {
    await truncateAll();
    resetRateLimitStore();
  });

  it('resets member password (owner caller)', async () => {
    const { tenant, user: owner } = await createTenant('Reset Test', 'owner@reset.com', 'Owner');

    const app = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenant.id,
      DEV_AUTH_USER_ID: owner.id,
      DEV_AUTH_ROLE: 'owner',
    });

    // Create member
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/users',
      payload: { email: 'member@reset.com', fullName: 'Member', role: 'member', password: 'old-password' },
    });
    const memberId = createRes.json().user.id;

    // Reset password
    const resetRes = await app.inject({
      method: 'POST',
      url: `/v1/users/${memberId}/reset-password`,
      payload: { password: 'new-password-123' },
    });

    expect(resetRes.statusCode).toBe(200);
    expect(resetRes.json().success).toBe(true);

    // Verify new password works via local/verify
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/local/verify',
      payload: { userId: memberId, password: 'new-password-123' },
    });
    expect(verifyRes.statusCode).toBe(200);
  });

  it('returns 403 when member tries to reset password', async () => {
    const { tenant, user: owner } = await createTenant('Guard Test', 'owner@guard.com', 'Owner');

    const app = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenant.id,
      DEV_AUTH_USER_ID: owner.id,
      DEV_AUTH_ROLE: 'owner',
    });

    // Create member
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/users',
      payload: { email: 'target@guard.com', fullName: 'Target', role: 'member', password: 'some-password' },
    });
    const memberId = createRes.json().user.id;

    // Try to reset as member
    const memberApp = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenant.id,
      DEV_AUTH_USER_ID: memberId,
      DEV_AUTH_ROLE: 'member',
    });
    const res = await memberApp.inject({
      method: 'POST',
      url: `/v1/users/${owner.id}/reset-password`,
      payload: { password: 'hacked-pw' },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 when trying to reset owner password', async () => {
    const { tenant, user: owner } = await createTenant('Owner Guard', 'owner@og.com', 'Owner');

    const app = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenant.id,
      DEV_AUTH_USER_ID: owner.id,
      DEV_AUTH_ROLE: 'owner',
    });

    // Create admin
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/users',
      payload: { email: 'admin@og.com', fullName: 'Admin', role: 'admin', password: 'admin-pass' },
    });
    const adminId = createRes.json().user.id;

    // Admin tries to reset owner
    const adminApp = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenant.id,
      DEV_AUTH_USER_ID: adminId,
      DEV_AUTH_ROLE: 'admin',
    });
    const res = await adminApp.inject({
      method: 'POST',
      url: `/v1/users/${owner.id}/reset-password`,
      payload: { password: 'new-pw-123' },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 403 when admin tries to reset admin password', async () => {
    const { tenant, user: owner } = await createTenant('A2A Guard', 'owner@a2a.com', 'Owner');

    const app = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenant.id,
      DEV_AUTH_USER_ID: owner.id,
      DEV_AUTH_ROLE: 'owner',
    });

    // Create two admins
    const a1Res = await app.inject({
      method: 'POST',
      url: '/v1/users',
      payload: { email: 'admin1@a2a.com', fullName: 'Admin1', role: 'admin', password: 'admin-pass' },
    });
    const admin1Id = a1Res.json().user.id;

    const a2Res = await app.inject({
      method: 'POST',
      url: '/v1/users',
      payload: { email: 'admin2@a2a.com', fullName: 'Admin2', role: 'admin', password: 'admin-pass' },
    });
    const admin2Id = a2Res.json().user.id;

    // Admin1 tries to reset Admin2
    const adminApp = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenant.id,
      DEV_AUTH_USER_ID: admin1Id,
      DEV_AUTH_ROLE: 'admin',
    });
    const res = await adminApp.inject({
      method: 'POST',
      url: `/v1/users/${admin2Id}/reset-password`,
      payload: { password: 'new-pw-123' },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 404 for non-existent user', async () => {
    const { tenant, user: owner } = await createTenant('404 Test', 'owner@404.com', 'Owner');

    const app = await buildTestApp({
      DEV_AUTH_TENANT_ID: tenant.id,
      DEV_AUTH_USER_ID: owner.id,
      DEV_AUTH_ROLE: 'owner',
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/users/00000000-0000-0000-0000-999999999999/reset-password',
      payload: { password: 'new-pw-123' },
    });

    expect(res.statusCode).toBe(404);
  });
});
