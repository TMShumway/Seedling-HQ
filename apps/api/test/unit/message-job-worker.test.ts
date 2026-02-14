import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageJobWorker } from '../../src/application/usecases/message-job-worker.js';
import type { MessageOutboxRepository } from '../../src/application/ports/message-outbox-repository.js';
import type { SmsSender } from '../../src/application/ports/sms-sender.js';
import type { EmailSender } from '../../src/application/ports/email-sender.js';
import type { SmsRecipientPrefsRepository } from '../../src/application/ports/sms-recipient-prefs-repository.js';
import type { BusinessSettingsRepository } from '../../src/application/ports/business-settings-repository.js';
import type { ClientRepository } from '../../src/application/ports/client-repository.js';
import type { AuditEventRepository } from '../../src/application/ports/audit-event-repository.js';
import type { AppConfig } from '../../src/shared/config.js';
import type { MessageOutbox } from '../../src/domain/entities/message-outbox.js';
import type { MessageJobPayload } from '../../src/application/dto/message-job-payload.js';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const OUTBOX_ID = '00000000-0000-0000-0000-000000000999';
const CORR_ID = 'corr-worker-test';

function makeConfig(): AppConfig {
  return {
    DATABASE_URL: 'test',
    API_PORT: 4000,
    NODE_ENV: 'test',
    AUTH_MODE: 'local',
    DEV_AUTH_TENANT_ID: '',
    DEV_AUTH_USER_ID: '',
    DEV_AUTH_ROLE: '',
    NOTIFICATION_ENABLED: true,
    SMTP_HOST: 'localhost',
    SMTP_PORT: 1025,
    SMTP_FROM: 'test@seedling.local',
    APP_BASE_URL: 'http://localhost:5173',
    SECURE_LINK_HMAC_SECRET: 'test-secret',
    COGNITO_USER_POOL_ID: '',
    COGNITO_CLIENT_ID: '',
    COGNITO_REGION: '',
    S3_BUCKET: 'test-bucket',
    S3_REGION: 'us-east-1',
    S3_ENDPOINT: 'http://localhost:4566',
    SMS_PROVIDER: 'stub' as const,
    SMS_ORIGINATION_IDENTITY: '',
    SQS_ENDPOINT: '',
    SQS_MESSAGE_QUEUE_URL: '',
    WORKER_MODE: 'off' as const,
  };
}

function makeSmsOutbox(overrides: Partial<MessageOutbox> = {}): MessageOutbox {
  return {
    id: OUTBOX_ID,
    tenantId: TENANT_ID,
    type: 'request_notification',
    recipientId: 'user-1',
    recipientType: 'user',
    channel: 'sms',
    destination: '+15551234567',
    subject: null,
    body: 'New request from John: I need lawn mowing',
    status: 'queued',
    provider: null,
    providerMessageId: null,
    attemptCount: 0,
    lastErrorCode: null,
    lastErrorMessage: null,
    correlationId: CORR_ID,
    scheduledFor: null,
    createdAt: new Date(),
    sentAt: null,
    ...overrides,
  };
}

function makeEmailOutbox(overrides: Partial<MessageOutbox> = {}): MessageOutbox {
  return {
    ...makeSmsOutbox(),
    channel: 'email',
    destination: 'owner@example.com',
    subject: 'New Request',
    body: '<html>...</html>',
    ...overrides,
  };
}

function makePayload(overrides: Partial<MessageJobPayload> = {}): MessageJobPayload {
  return {
    jobType: 'sms.send',
    outboxId: OUTBOX_ID,
    tenantId: TENANT_ID,
    correlationId: CORR_ID,
    ...overrides,
  };
}

describe('MessageJobWorker', () => {
  let outboxRepo: MessageOutboxRepository;
  let smsSender: SmsSender;
  let emailSender: EmailSender;
  let smsPrefsRepo: SmsRecipientPrefsRepository;
  let settingsRepo: BusinessSettingsRepository;
  let clientRepo: ClientRepository;
  let auditRepo: AuditEventRepository;
  let config: AppConfig;
  let worker: MessageJobWorker;

  beforeEach(() => {
    outboxRepo = {
      getById: vi.fn().mockResolvedValue(makeSmsOutbox()),
      create: vi.fn().mockResolvedValue({}),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    };

    smsSender = {
      send: vi.fn().mockResolvedValue({ providerMessageId: 'sms-msg-001' }),
    };

    emailSender = {
      send: vi.fn().mockResolvedValue({ messageId: 'email-msg-001' }),
    };

    smsPrefsRepo = {
      getByPhone: vi.fn().mockResolvedValue(null),
    };

    settingsRepo = {
      getByTenantId: vi.fn().mockResolvedValue({
        id: 'settings-1',
        tenantId: TENANT_ID,
        phone: '+15559999999',
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
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      upsert: vi.fn(),
    };

    clientRepo = {
      getById: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue({ data: [], cursor: null, hasMore: false }),
      create: vi.fn(),
      update: vi.fn(),
      deactivate: vi.fn(),
      count: vi.fn(),
    };

    auditRepo = {
      record: vi.fn().mockResolvedValue(undefined),
      listBySubjects: vi.fn().mockResolvedValue({ data: [], cursor: null, hasMore: false }),
    };

    config = makeConfig();

    worker = new MessageJobWorker({
      outboxRepo,
      smsSender,
      emailSender,
      smsPrefsRepo,
      settingsRepo,
      clientRepo,
      auditRepo,
      config,
    });
  });

  // ── SMS Happy Path ──────────────────────────────────────────────

  it('SMS happy path: loads → opt-out check → sends → marks sent + audit', async () => {
    await worker.processJob(makePayload());

    expect(outboxRepo.getById).toHaveBeenCalledWith(OUTBOX_ID);
    expect(smsPrefsRepo.getByPhone).toHaveBeenCalledWith(TENANT_ID, '+15551234567');
    expect(smsSender.send).toHaveBeenCalledWith('+15551234567', 'New request from John: I need lawn mowing', '');
    expect(outboxRepo.updateStatus).toHaveBeenCalledWith(OUTBOX_ID, 'sent', expect.objectContaining({
      provider: 'stub',
      providerMessageId: 'sms-msg-001',
      sentAt: expect.any(Date),
    }));
    expect(auditRepo.record).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: TENANT_ID,
      eventName: 'message.sent',
      subjectType: 'message_outbox',
      subjectId: OUTBOX_ID,
    }));
  });

  // ── Email Happy Path ────────────────────────────────────────────

  it('Email happy path: loads → sends → marks sent + audit', async () => {
    (outboxRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeEmailOutbox());

    await worker.processJob(makePayload());

    expect(emailSender.send).toHaveBeenCalledWith(expect.objectContaining({
      to: 'owner@example.com',
      subject: 'New Request',
    }));
    expect(outboxRepo.updateStatus).toHaveBeenCalledWith(OUTBOX_ID, 'sent', expect.objectContaining({
      provider: 'smtp',
      providerMessageId: 'email-msg-001',
    }));
    expect(auditRepo.record).toHaveBeenCalledWith(expect.objectContaining({
      eventName: 'message.sent',
    }));
  });

  // ── Idempotency ─────────────────────────────────────────────────

  it('idempotent: status=sent → skips without error', async () => {
    (outboxRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSmsOutbox({ status: 'sent', sentAt: new Date() }),
    );

    await worker.processJob(makePayload());

    expect(smsSender.send).not.toHaveBeenCalled();
    expect(outboxRepo.updateStatus).not.toHaveBeenCalled();
  });

  // ── Terminal: Max Attempts ──────────────────────────────────────

  it('terminal: attemptCount >= MAX_ATTEMPTS → marks failed', async () => {
    (outboxRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSmsOutbox({ attemptCount: 3 }),
    );

    await worker.processJob(makePayload());

    expect(smsSender.send).not.toHaveBeenCalled();
    expect(outboxRepo.updateStatus).toHaveBeenCalledWith(OUTBOX_ID, 'failed', expect.objectContaining({
      lastErrorCode: 'MAX_ATTEMPTS_EXCEEDED',
    }));
  });

  // ── Crash Recovery ──────────────────────────────────────────────

  it('crash recovery: providerMessageId set but status!=sent → marks sent', async () => {
    (outboxRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSmsOutbox({ providerMessageId: 'sms-crash-001', status: 'queued' }),
    );

    await worker.processJob(makePayload());

    expect(smsSender.send).not.toHaveBeenCalled();
    expect(outboxRepo.updateStatus).toHaveBeenCalledWith(OUTBOX_ID, 'sent', expect.objectContaining({
      providerMessageId: 'sms-crash-001',
      sentAt: expect.any(Date),
    }));
  });

  // ── Tenant Mismatch ─────────────────────────────────────────────

  it('tenant mismatch → throws error', async () => {
    await expect(
      worker.processJob(makePayload({ tenantId: 'wrong-tenant' })),
    ).rejects.toThrow('Tenant mismatch');
  });

  // ── Opt-Out ─────────────────────────────────────────────────────

  it('opt-out → marks failed with RECIPIENT_OPTED_OUT', async () => {
    (smsPrefsRepo.getByPhone as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'prefs-1',
      tenantId: TENANT_ID,
      phone: '+15551234567',
      optedOut: true,
      optedOutAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await worker.processJob(makePayload());

    expect(smsSender.send).not.toHaveBeenCalled();
    expect(outboxRepo.updateStatus).toHaveBeenCalledWith(OUTBOX_ID, 'failed', expect.objectContaining({
      lastErrorCode: 'RECIPIENT_OPTED_OUT',
    }));
  });

  // ── SMS Failure → Throws (SQS redelivers) ──────────────────────

  it('SMS failure → updates error, throws for SQS redelivery', async () => {
    (smsSender.send as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network timeout'));

    await expect(worker.processJob(makePayload())).rejects.toThrow('Network timeout');

    expect(outboxRepo.updateStatus).toHaveBeenCalledWith(OUTBOX_ID, 'queued', expect.objectContaining({
      lastErrorCode: 'SEND_FAILED',
      lastErrorMessage: 'Network timeout',
    }));
  });

  // ── Missing Outbox ──────────────────────────────────────────────

  it('missing outbox (getById returns null) → logs warning, no throw', async () => {
    (outboxRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    // Should NOT throw
    await worker.processJob(makePayload());

    expect(smsSender.send).not.toHaveBeenCalled();
    expect(outboxRepo.updateStatus).not.toHaveBeenCalled();
  });

  // ── Null Destination → Fallback Resolve ─────────────────────────

  it('null destination → resolves from BusinessSettings.phone for user recipient', async () => {
    (outboxRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSmsOutbox({ destination: null, recipientType: 'user' }),
    );

    await worker.processJob(makePayload());

    expect(settingsRepo.getByTenantId).toHaveBeenCalledWith(TENANT_ID);
    expect(smsSender.send).toHaveBeenCalledWith('+15559999999', expect.any(String), '');
  });

  it('null destination → resolves from Client.phone for client recipient', async () => {
    (outboxRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSmsOutbox({ destination: null, recipientType: 'client', recipientId: 'client-1' }),
    );
    (clientRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'client-1',
      tenantId: TENANT_ID,
      firstName: 'John',
      lastName: 'Smith',
      email: null,
      phone: '+15558887777',
      company: null,
      notes: null,
      tags: [],
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await worker.processJob(makePayload());

    expect(clientRepo.getById).toHaveBeenCalledWith(TENANT_ID, 'client-1');
    expect(smsSender.send).toHaveBeenCalledWith('+15558887777', expect.any(String), '');
  });

  // ── Null Destination + Unresolvable ─────────────────────────────

  it('null destination + unresolvable → marks failed with NO_DESTINATION', async () => {
    (outboxRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSmsOutbox({ destination: null, recipientType: 'user' }),
    );
    (settingsRepo.getByTenantId as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'settings-1',
      tenantId: TENANT_ID,
      phone: null,
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
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await worker.processJob(makePayload());

    expect(smsSender.send).not.toHaveBeenCalled();
    expect(outboxRepo.updateStatus).toHaveBeenCalledWith(OUTBOX_ID, 'failed', expect.objectContaining({
      lastErrorCode: 'NO_DESTINATION',
    }));
  });

  // ── PII: No Phone/Body in Logs ──────────────────────────────────

  it('PII: audit metadata does not contain phone or body', async () => {
    await worker.processJob(makePayload());

    const auditCall = (auditRepo.record as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const metadataStr = JSON.stringify(auditCall.metadata ?? {});
    expect(metadataStr).not.toContain('+15551234567');
    expect(metadataStr).not.toContain('New request from John');
  });
});
