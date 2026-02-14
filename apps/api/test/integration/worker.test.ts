import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { truncateAll, getDb, getPool, makeConfig, buildTestApp } from './setup.js';
import { messageOutbox, smsRecipientPrefs, auditEvents, tenants, users, businessSettings } from '../../src/infra/db/schema.js';
import { MessageJobWorker } from '../../src/application/usecases/message-job-worker.js';
import { DrizzleMessageOutboxRepository } from '../../src/infra/db/repositories/drizzle-message-outbox-repository.js';
import { DrizzleAuditEventRepository } from '../../src/infra/db/repositories/drizzle-audit-event-repository.js';
import { DrizzleBusinessSettingsRepository } from '../../src/infra/db/repositories/drizzle-business-settings-repository.js';
import { DrizzleClientRepository } from '../../src/infra/db/repositories/drizzle-client-repository.js';
import { DrizzleSmsRecipientPrefsRepository } from '../../src/infra/db/repositories/drizzle-sms-recipient-prefs-repository.js';
import { StubSmsSender } from '../../src/infra/sms/stub-sms-sender.js';
import { resetRateLimitStore } from '../../src/adapters/http/middleware/rate-limit.js';
import type { EmailSender } from '../../src/application/ports/email-sender.js';
import type { MessageJobPayload } from '../../src/application/dto/message-job-payload.js';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const OWNER_ID = '00000000-0000-0000-0000-000000000010';
const CORR_ID = 'corr-worker-integ';

afterAll(async () => {
  await getPool().end();
});

async function seedTenantAndOwner() {
  const db = getDb();
  await db.insert(tenants).values({
    id: TENANT_ID,
    slug: 'worker-test-biz',
    name: 'Worker Test Biz',
  }).onConflictDoNothing();
  await db.insert(users).values({
    id: OWNER_ID,
    tenantId: TENANT_ID,
    email: 'worker-owner@test.com',
    fullName: 'Worker Owner',
    role: 'owner',
    status: 'active',
  }).onConflictDoNothing();
}

function createWorker(emailSender?: EmailSender) {
  const db = getDb();
  const config = makeConfig();
  return new MessageJobWorker({
    outboxRepo: new DrizzleMessageOutboxRepository(db),
    smsSender: new StubSmsSender(),
    emailSender: emailSender ?? { send: async () => ({ messageId: 'integ-email-001' }) },
    smsPrefsRepo: new DrizzleSmsRecipientPrefsRepository(db),
    settingsRepo: new DrizzleBusinessSettingsRepository(db),
    clientRepo: new DrizzleClientRepository(db),
    auditRepo: new DrizzleAuditEventRepository(db),
    config,
  });
}

async function insertOutbox(overrides: Record<string, unknown> = {}) {
  const db = getDb();
  const id = (overrides.id as string) ?? randomUUID();
  await db.insert(messageOutbox).values({
    id,
    tenantId: TENANT_ID,
    type: 'request_notification',
    recipientId: OWNER_ID,
    recipientType: 'user',
    channel: 'sms',
    destination: '+15551234567',
    body: 'New request from John: I need lawn mowing',
    status: 'queued',
    correlationId: CORR_ID,
    ...overrides,
  } as any);
  return id;
}

describe('MessageJobWorker integration', () => {
  beforeEach(async () => {
    await truncateAll();
    await seedTenantAndOwner();
  });

  it('processes SMS job: outbox transitions to sent + audit event', async () => {
    const outboxId = await insertOutbox();
    const worker = createWorker();

    await worker.processJob({
      jobType: 'sms.send',
      outboxId,
      tenantId: TENANT_ID,
      correlationId: CORR_ID,
    });

    const db = getDb();
    const [row] = await db.select().from(messageOutbox).where(eq(messageOutbox.id, outboxId));
    expect(row.status).toBe('sent');
    expect(row.provider).toBe('stub');
    expect(row.providerMessageId).toBeTruthy();
    expect(row.sentAt).toBeTruthy();
    expect(row.attemptCount).toBe(1);

    // Audit event
    const audits = await db.select().from(auditEvents).where(eq(auditEvents.subjectId, outboxId));
    expect(audits).toHaveLength(1);
    expect(audits[0].eventName).toBe('message.sent');
    expect(audits[0].principalType).toBe('system');
  });

  it('processes email job: outbox transitions to sent', async () => {
    const outboxId = await insertOutbox({
      channel: 'email',
      destination: 'owner@test.com',
      subject: 'Test Email',
      body: '<html>Hello</html>',
    });
    const worker = createWorker();

    await worker.processJob({
      jobType: 'sms.send',
      outboxId,
      tenantId: TENANT_ID,
      correlationId: CORR_ID,
    });

    const db = getDb();
    const [row] = await db.select().from(messageOutbox).where(eq(messageOutbox.id, outboxId));
    expect(row.status).toBe('sent');
    expect(row.provider).toBe('smtp');
  });

  it('opt-out enforced: outbox transitions to failed with RECIPIENT_OPTED_OUT', async () => {
    const outboxId = await insertOutbox();
    const db = getDb();

    await db.insert(smsRecipientPrefs).values({
      id: randomUUID(),
      tenantId: TENANT_ID,
      phone: '+15551234567',
      optedOut: true,
      optedOutAt: new Date(),
    });

    const worker = createWorker();
    await worker.processJob({
      jobType: 'sms.send',
      outboxId,
      tenantId: TENANT_ID,
      correlationId: CORR_ID,
    });

    const [row] = await db.select().from(messageOutbox).where(eq(messageOutbox.id, outboxId));
    expect(row.status).toBe('failed');
    expect(row.lastErrorCode).toBe('RECIPIENT_OPTED_OUT');
  });

  it('idempotency: already-sent record is unchanged', async () => {
    const outboxId = await insertOutbox();
    const db = getDb();

    const worker = createWorker();
    await worker.processJob({
      jobType: 'sms.send',
      outboxId,
      tenantId: TENANT_ID,
      correlationId: CORR_ID,
    });

    const [before] = await db.select().from(messageOutbox).where(eq(messageOutbox.id, outboxId));
    expect(before.status).toBe('sent');

    // Process again — should be idempotent
    await worker.processJob({
      jobType: 'sms.send',
      outboxId,
      tenantId: TENANT_ID,
      correlationId: CORR_ID,
    });

    const [after] = await db.select().from(messageOutbox).where(eq(messageOutbox.id, outboxId));
    expect(after.status).toBe('sent');
    expect(after.sentAt?.toISOString()).toBe(before.sentAt?.toISOString());
    expect(after.attemptCount).toBe(before.attemptCount);
  });

  it('cross-tenant rejection', async () => {
    const outboxId = await insertOutbox();
    const worker = createWorker();

    await expect(
      worker.processJob({
        jobType: 'sms.send',
        outboxId,
        tenantId: 'wrong-tenant-id',
        correlationId: CORR_ID,
      }),
    ).rejects.toThrow('Tenant mismatch');
  });

  it('request route creates SMS outbox with destination from business settings', async () => {
    const db = getDb();
    await db.insert(businessSettings).values({
      id: randomUUID(),
      tenantId: TENANT_ID,
      phone: '+15559999999',
    });

    const testApp = await buildTestApp({
      DEV_AUTH_TENANT_ID: TENANT_ID,
      DEV_AUTH_USER_ID: OWNER_ID,
      NOTIFICATION_ENABLED: true,
    });
    resetRateLimitStore();

    const res = await testApp.inject({
      method: 'POST',
      url: '/v1/public/requests/worker-test-biz',
      payload: {
        clientName: 'Integ Client',
        clientEmail: 'integ@example.com',
        description: 'Integration test request',
      },
    });

    expect(res.statusCode).toBe(201);

    const records = await db.select().from(messageOutbox).where(eq(messageOutbox.tenantId, TENANT_ID));
    const smsRecord = records.find((r) => r.channel === 'sms');
    expect(smsRecord).toBeDefined();
    expect(smsRecord!.destination).toBe('+15559999999');
    expect(smsRecord!.status).toBe('queued');
  });
});
