import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildTestApp, truncateAll, getDb, getPool } from './setup.js';
import { messageOutbox } from '../../src/infra/db/schema.js';
import { resetRateLimitStore } from '../../src/adapters/http/middleware/rate-limit.js';

afterAll(async () => {
  await getPool().end();
});

async function createTenantWithNotifications() {
  // Create tenant via unauthenticated app
  const setupApp = await buildTestApp();
  const createRes = await setupApp.inject({
    method: 'POST',
    url: '/v1/tenants',
    payload: {
      businessName: 'Notif Test Biz',
      ownerEmail: 'notif-owner@test.com',
      ownerFullName: 'Notif Owner',
      ownerPassword: 'test-password',
    },
  });
  const created = createRes.json();

  // Build app with notifications enabled for the created tenant
  const app = await buildTestApp({
    DEV_AUTH_TENANT_ID: created.tenant.id,
    DEV_AUTH_USER_ID: created.user.id,
    NOTIFICATION_ENABLED: true,
  });

  // Build public app with notifications enabled
  const publicApp = await buildTestApp({
    NOTIFICATION_ENABLED: true,
  });

  return { app, publicApp, tenant: created.tenant, user: created.user };
}

describe('Notification integration: POST /v1/public/requests/:tenantSlug', () => {
  beforeEach(async () => {
    await truncateAll();
    resetRateLimitStore();
  });

  it('creates email and SMS outbox records on public request', async () => {
    const { publicApp, tenant } = await createTenantWithNotifications();
    const db = getDb();

    const res = await publicApp.inject({
      method: 'POST',
      url: `/v1/public/requests/${tenant.slug}`,
      payload: {
        clientName: 'John Smith',
        clientEmail: 'john@example.com',
        clientPhone: '555-1234',
        description: 'I need lawn service',
      },
    });

    expect(res.statusCode).toBe(201);

    // Check outbox records
    const records = await db
      .select()
      .from(messageOutbox)
      .where(eq(messageOutbox.tenantId, tenant.id));

    expect(records).toHaveLength(2);

    const emailRecord = records.find((r) => r.channel === 'email');
    expect(emailRecord).toBeDefined();
    expect(emailRecord!.type).toBe('request_notification');
    expect(emailRecord!.recipientType).toBe('user');
    // Email status depends on Mailpit availability — could be 'sent' or 'failed'
    expect(['sent', 'failed']).toContain(emailRecord!.status);

    const smsRecord = records.find((r) => r.channel === 'sms');
    expect(smsRecord).toBeDefined();
    // No business settings phone configured → SMS outbox created as failed/NO_DESTINATION
    expect(smsRecord!.status).toBe('failed');
    expect(smsRecord!.lastErrorCode).toBe('NO_DESTINATION');
    expect(smsRecord!.type).toBe('request_notification');
  });

  it('does not create outbox records for honeypot requests', async () => {
    const { publicApp, tenant } = await createTenantWithNotifications();
    const db = getDb();

    const res = await publicApp.inject({
      method: 'POST',
      url: `/v1/public/requests/${tenant.slug}`,
      payload: {
        clientName: 'Bot User',
        clientEmail: 'bot@spam.com',
        description: 'Buy stuff',
        website: 'http://spam.com',
      },
    });

    expect(res.statusCode).toBe(201);

    const records = await db
      .select()
      .from(messageOutbox)
      .where(eq(messageOutbox.tenantId, tenant.id));

    expect(records).toHaveLength(0);
  });

  it('request still returns 201 even if SMTP is unreachable', async () => {
    // Build app pointing to a non-existent SMTP server
    const setupApp = await buildTestApp();
    const createRes = await setupApp.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: {
        businessName: 'SMTP Fail Biz',
        ownerEmail: 'smtp-fail@test.com',
        ownerFullName: 'SMTP Fail Owner',
        ownerPassword: 'test-password',
      },
    });
    const created = createRes.json();

    const publicApp = await buildTestApp({
      NOTIFICATION_ENABLED: true,
      SMTP_HOST: 'localhost',
      SMTP_PORT: 19999, // non-existent SMTP
    });
    const db = getDb();

    const res = await publicApp.inject({
      method: 'POST',
      url: `/v1/public/requests/${created.tenant.slug}`,
      payload: {
        clientName: 'Jane Doe',
        clientEmail: 'jane@example.com',
        description: 'Tree trimming needed',
      },
    });

    // Request should still succeed
    expect(res.statusCode).toBe(201);

    // Email outbox should be 'failed'
    const records = await db
      .select()
      .from(messageOutbox)
      .where(eq(messageOutbox.tenantId, created.tenant.id));

    const emailRecord = records.find((r) => r.channel === 'email');
    expect(emailRecord).toBeDefined();
    expect(emailRecord!.status).toBe('failed');
    expect(emailRecord!.lastErrorMessage).toBeTruthy();
  });

  it('does not create outbox records when NOTIFICATION_ENABLED is false', async () => {
    // Use default setup which has NOTIFICATION_ENABLED=false
    const setupApp = await buildTestApp();
    const createRes = await setupApp.inject({
      method: 'POST',
      url: '/v1/tenants',
      payload: {
        businessName: 'Disabled Notif Biz',
        ownerEmail: 'disabled@test.com',
        ownerFullName: 'Disabled Owner',
        ownerPassword: 'test-password',
      },
    });
    const created = createRes.json();

    const publicApp = await buildTestApp({
      NOTIFICATION_ENABLED: false,
    });
    const db = getDb();

    const res = await publicApp.inject({
      method: 'POST',
      url: `/v1/public/requests/${created.tenant.slug}`,
      payload: {
        clientName: 'No Notif',
        clientEmail: 'nonotif@example.com',
        description: 'Should not trigger notification',
      },
    });

    expect(res.statusCode).toBe(201);

    const records = await db
      .select()
      .from(messageOutbox)
      .where(eq(messageOutbox.tenantId, created.tenant.id));

    expect(records).toHaveLength(0);
  });
});
