import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { getDb, getPool, truncateAll, buildTestApp } from './setup.js';
import { resetRateLimitStore } from '../../src/adapters/http/middleware/rate-limit.js';
import { randomUUID } from 'node:crypto';
import { tenants, users, clients, quotes, jobs, visits } from '../../src/infra/db/schema.js';
import { hashPassword } from '../../src/shared/password.js';

const TENANT_ID = randomUUID();
const OWNER_ID = randomUUID();
const MEMBER_ID = randomUUID();
const CLIENT_ID = randomUUID();
const QUOTE_ID = randomUUID();
const JOB_ID = randomUUID();
const VISIT_ID = randomUUID();

async function seedTestData() {
  const db = getDb();
  const passwordHash = await hashPassword('password');

  await db.insert(tenants).values({ id: TENANT_ID, slug: `notes-test-${TENANT_ID.slice(0, 8)}`, name: 'Notes Test Co' });
  await db.insert(users).values([
    { id: OWNER_ID, tenantId: TENANT_ID, email: 'owner@notes.test', fullName: 'Owner User', role: 'owner', passwordHash, status: 'active' },
    { id: MEMBER_ID, tenantId: TENANT_ID, email: 'member@notes.test', fullName: 'Member User', role: 'member', passwordHash, status: 'active' },
  ]);
  await db.insert(clients).values({ id: CLIENT_ID, tenantId: TENANT_ID, firstName: 'Notes', lastName: 'Client', email: 'client@notes.test' });
  await db.insert(quotes).values({ id: QUOTE_ID, tenantId: TENANT_ID, clientId: CLIENT_ID, title: 'Notes Test Quote', status: 'scheduled', lineItems: [], subtotal: 0, tax: 0, total: 0 });
  await db.insert(jobs).values({ id: JOB_ID, tenantId: TENANT_ID, quoteId: QUOTE_ID, clientId: CLIENT_ID, title: 'Notes Test Job', status: 'scheduled' });
  await db.insert(visits).values({
    id: VISIT_ID,
    tenantId: TENANT_ID,
    jobId: JOB_ID,
    assignedUserId: MEMBER_ID,
    estimatedDurationMinutes: 60,
    status: 'started',
  });
}

describe('PATCH /v1/visits/:id/notes', () => {
  beforeEach(async () => {
    await truncateAll();
    resetRateLimitStore();
    await seedTestData();
  });

  afterAll(async () => {
    await getPool().end();
  });

  it('updates notes on a started visit', async () => {
    const app = await buildTestApp({ DEV_AUTH_TENANT_ID: TENANT_ID, DEV_AUTH_USER_ID: OWNER_ID, DEV_AUTH_ROLE: 'owner' });

    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/visits/${VISIT_ID}/notes`,
      payload: { notes: 'Lawn mowed successfully' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.visit.notes).toBe('Lawn mowed successfully');
    expect(body.visit.id).toBe(VISIT_ID);
  });

  it('clears notes with null', async () => {
    const app = await buildTestApp({ DEV_AUTH_TENANT_ID: TENANT_ID, DEV_AUTH_USER_ID: OWNER_ID, DEV_AUTH_ROLE: 'owner' });

    // Set notes first
    await app.inject({ method: 'PATCH', url: `/v1/visits/${VISIT_ID}/notes`, payload: { notes: 'Some notes' } });

    // Clear notes
    const res = await app.inject({ method: 'PATCH', url: `/v1/visits/${VISIT_ID}/notes`, payload: { notes: null } });
    expect(res.statusCode).toBe(200);
    expect(res.json().visit.notes).toBeNull();
  });

  it('rejects notes on scheduled visit', async () => {
    const db = getDb();
    const scheduledVisitId = randomUUID();
    await db.insert(visits).values({
      id: scheduledVisitId,
      tenantId: TENANT_ID,
      jobId: JOB_ID,
      assignedUserId: MEMBER_ID,
      estimatedDurationMinutes: 60,
      status: 'scheduled',
    });

    const app = await buildTestApp({ DEV_AUTH_TENANT_ID: TENANT_ID, DEV_AUTH_USER_ID: OWNER_ID, DEV_AUTH_ROLE: 'owner' });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/visits/${scheduledVisitId}/notes`,
      payload: { notes: 'test' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('allows member to update own assigned visit', async () => {
    const app = await buildTestApp({ DEV_AUTH_TENANT_ID: TENANT_ID, DEV_AUTH_USER_ID: MEMBER_ID, DEV_AUTH_ROLE: 'member' });

    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/visits/${VISIT_ID}/notes`,
      payload: { notes: 'Member notes' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().visit.notes).toBe('Member notes');
  });

  it('rejects member on unassigned visit', async () => {
    const db = getDb();
    const otherVisitId = randomUUID();
    await db.insert(visits).values({
      id: otherVisitId,
      tenantId: TENANT_ID,
      jobId: JOB_ID,
      assignedUserId: OWNER_ID,
      estimatedDurationMinutes: 60,
      status: 'started',
    });

    const app = await buildTestApp({ DEV_AUTH_TENANT_ID: TENANT_ID, DEV_AUTH_USER_ID: MEMBER_ID, DEV_AUTH_ROLE: 'member' });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/visits/${otherVisitId}/notes`,
      payload: { notes: 'Not my visit' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns 404 for nonexistent visit', async () => {
    const app = await buildTestApp({ DEV_AUTH_TENANT_ID: TENANT_ID, DEV_AUTH_USER_ID: OWNER_ID, DEV_AUTH_ROLE: 'owner' });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/visits/00000000-0000-0000-0000-000000000999/notes`,
      payload: { notes: 'test' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('allows notes on completed visit', async () => {
    const db = getDb();
    const completedId = randomUUID();
    await db.insert(visits).values({
      id: completedId,
      tenantId: TENANT_ID,
      jobId: JOB_ID,
      assignedUserId: MEMBER_ID,
      estimatedDurationMinutes: 60,
      status: 'completed',
      completedAt: new Date(),
    });

    const app = await buildTestApp({ DEV_AUTH_TENANT_ID: TENANT_ID, DEV_AUTH_USER_ID: OWNER_ID, DEV_AUTH_ROLE: 'owner' });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/visits/${completedId}/notes`,
      payload: { notes: 'Post-completion notes' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().visit.notes).toBe('Post-completion notes');
  });
});
