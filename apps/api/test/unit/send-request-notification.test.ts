import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SendRequestNotificationUseCase } from '../../src/application/usecases/send-request-notification.js';
import type { UserRepository } from '../../src/application/ports/user-repository.js';
import type { MessageOutboxRepository } from '../../src/application/ports/message-outbox-repository.js';
import type { EmailSender } from '../../src/application/ports/email-sender.js';
import type { BusinessSettingsRepository } from '../../src/application/ports/business-settings-repository.js';
import type { MessageQueuePublisher } from '../../src/application/ports/message-queue-publisher.js';
import type { AppConfig } from '../../src/shared/config.js';
import type { Request } from '../../src/domain/entities/request.js';
import type { MessageOutbox } from '../../src/domain/entities/message-outbox.js';

const OWNER = {
  id: 'owner-1',
  tenantId: 'tenant-1',
  email: 'owner@example.com',
  fullName: 'Jane Owner',
  role: 'owner' as const,
  passwordHash: null,
  status: 'active' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const REQUEST: Request = {
  id: 'req-1',
  tenantId: 'tenant-1',
  source: 'public_form',
  clientName: 'John Smith',
  clientEmail: 'john@example.com',
  clientPhone: '555-1234',
  description: 'I need lawn mowing service',
  status: 'new',
  assignedUserId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    API_PORT: 4000,
    NODE_ENV: 'test',
    AUTH_MODE: 'local',
    DEV_AUTH_TENANT_ID: '',
    DEV_AUTH_USER_ID: '',
    DEV_AUTH_ROLE: '',
    NOTIFICATION_ENABLED: true,
    SMTP_HOST: 'localhost',
    SMTP_PORT: 1025,
    SMTP_FROM: 'noreply@seedling.local',
    APP_BASE_URL: 'http://localhost:5173',
    SECURE_LINK_HMAC_SECRET: 'test-secret-for-unit-tests',
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
    ...overrides,
  };
}

function makeUserRepo(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    create: vi.fn(async (u) => ({ ...u, createdAt: new Date(), updatedAt: new Date() })),
    getById: vi.fn(async () => null),
    getByIdGlobal: vi.fn(async () => null),
    getByEmail: vi.fn(async () => null),
    getOwnerByTenantId: vi.fn(async () => OWNER),
    listActiveByEmail: vi.fn(async () => []),
    listByTenantId: vi.fn(async () => []),
    updatePasswordHash: vi.fn(async () => null),
    updateStatus: vi.fn(async () => null),
    updateUser: vi.fn(async () => null),
    ...overrides,
  };
}

function makeOutboxRepo(): MessageOutboxRepository & { created: MessageOutbox[] } {
  const created: MessageOutbox[] = [];
  return {
    created,
    getById: vi.fn(async () => null),
    create: vi.fn(async (o) => {
      const record = { ...o, attemptCount: 0, createdAt: new Date(), sentAt: null } as MessageOutbox;
      created.push(record);
      return record;
    }),
    updateStatus: vi.fn(async () => {}),
  };
}

function makeEmailSender(overrides: Partial<EmailSender> = {}): EmailSender {
  return {
    send: vi.fn(async () => ({ messageId: 'msg-123' })),
    ...overrides,
  };
}

function makeSettingsRepo(phone: string | null = '+15559999999'): BusinessSettingsRepository {
  return {
    getByTenantId: vi.fn(async () => ({
      id: 'settings-1',
      tenantId: 'tenant-1',
      phone,
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
    })),
    upsert: vi.fn(),
  };
}

function makeQueuePublisher(): MessageQueuePublisher {
  return {
    publish: vi.fn(async () => {}),
  };
}

const correlationId = 'corr-test';

describe('SendRequestNotificationUseCase', () => {
  let userRepo: UserRepository;
  let outboxRepo: ReturnType<typeof makeOutboxRepo>;
  let emailSender: EmailSender;
  let settingsRepo: BusinessSettingsRepository;
  let queuePublisher: MessageQueuePublisher;
  let config: AppConfig;
  let useCase: SendRequestNotificationUseCase;

  beforeEach(() => {
    userRepo = makeUserRepo();
    outboxRepo = makeOutboxRepo();
    emailSender = makeEmailSender();
    settingsRepo = makeSettingsRepo();
    queuePublisher = makeQueuePublisher();
    config = makeConfig();
    useCase = new SendRequestNotificationUseCase(userRepo, outboxRepo, emailSender, config, settingsRepo, queuePublisher);
  });

  it('creates email outbox record, sends email, and updates to sent', async () => {
    await useCase.execute('tenant-1', 'Demo Business', REQUEST, correlationId);

    // Email outbox created
    const emailRecord = outboxRepo.created.find((r) => r.channel === 'email');
    expect(emailRecord).toBeDefined();
    expect(emailRecord!.status).toBe('queued');
    expect(emailRecord!.tenantId).toBe('tenant-1');
    expect(emailRecord!.type).toBe('request_notification');
    expect(emailRecord!.recipientId).toBe('owner-1');
    expect(emailRecord!.recipientType).toBe('user');

    // Email sent
    expect(emailSender.send).toHaveBeenCalledOnce();

    // Outbox updated to sent
    expect(outboxRepo.updateStatus).toHaveBeenCalledWith(
      emailRecord!.id,
      'sent',
      expect.objectContaining({
        provider: 'smtp',
        providerMessageId: 'msg-123',
      }),
    );
  });

  it('creates SMS outbox record as queued without sending', async () => {
    await useCase.execute('tenant-1', 'Demo Business', REQUEST, correlationId);

    const smsRecord = outboxRepo.created.find((r) => r.channel === 'sms');
    expect(smsRecord).toBeDefined();
    expect(smsRecord!.status).toBe('queued');
    expect(smsRecord!.tenantId).toBe('tenant-1');
    expect(smsRecord!.type).toBe('request_notification');

    // Only one email send call, no SMS send
    expect(emailSender.send).toHaveBeenCalledOnce();
  });

  it('updates email outbox to failed on SMTP error without throwing', async () => {
    emailSender = makeEmailSender({
      send: vi.fn(async () => {
        throw new Error('SMTP connection refused');
      }),
    });
    useCase = new SendRequestNotificationUseCase(userRepo, outboxRepo, emailSender, config, settingsRepo, queuePublisher);

    // Should NOT throw
    await useCase.execute('tenant-1', 'Demo Business', REQUEST, correlationId);

    const emailRecord = outboxRepo.created.find((r) => r.channel === 'email');
    expect(outboxRepo.updateStatus).toHaveBeenCalledWith(
      emailRecord!.id,
      'failed',
      expect.objectContaining({
        lastErrorMessage: 'SMTP connection refused',
      }),
    );
  });

  it('returns immediately when NOTIFICATION_ENABLED is false', async () => {
    config = makeConfig({ NOTIFICATION_ENABLED: false });
    useCase = new SendRequestNotificationUseCase(userRepo, outboxRepo, emailSender, config, settingsRepo, queuePublisher);

    await useCase.execute('tenant-1', 'Demo Business', REQUEST, correlationId);

    expect(userRepo.getOwnerByTenantId).not.toHaveBeenCalled();
    expect(outboxRepo.create).not.toHaveBeenCalled();
    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it('returns silently when no owner found', async () => {
    userRepo = makeUserRepo({
      getOwnerByTenantId: vi.fn(async () => null),
    });
    useCase = new SendRequestNotificationUseCase(userRepo, outboxRepo, emailSender, config, settingsRepo, queuePublisher);

    await useCase.execute('tenant-1', 'Demo Business', REQUEST, correlationId);

    expect(outboxRepo.create).not.toHaveBeenCalled();
    expect(emailSender.send).not.toHaveBeenCalled();
  });

  it('email subject contains client name', async () => {
    await useCase.execute('tenant-1', 'Demo Business', REQUEST, correlationId);

    const sendCall = vi.mocked(emailSender.send).mock.calls[0][0];
    expect(sendCall.subject).toContain('John Smith');
  });

  it('email body contains request details', async () => {
    await useCase.execute('tenant-1', 'Demo Business', REQUEST, correlationId);

    const sendCall = vi.mocked(emailSender.send).mock.calls[0][0];
    expect(sendCall.html).toContain('John Smith');
    expect(sendCall.html).toContain('john@example.com');
    expect(sendCall.html).toContain('I need lawn mowing service');
  });

  it('correlation ID flows to outbox records', async () => {
    await useCase.execute('tenant-1', 'Demo Business', REQUEST, correlationId);

    for (const record of outboxRepo.created) {
      expect(record.correlationId).toBe(correlationId);
    }
  });

  it('creates two outbox records (email + SMS)', async () => {
    await useCase.execute('tenant-1', 'Demo Business', REQUEST, correlationId);

    expect(outboxRepo.created).toHaveLength(2);
    const channels = outboxRepo.created.map((r) => r.channel);
    expect(channels).toContain('email');
    expect(channels).toContain('sms');
  });

  it('never throws even if outbox repo fails', async () => {
    outboxRepo.create = vi.fn(async () => {
      throw new Error('DB connection lost');
    });
    outboxRepo.created = [];
    useCase = new SendRequestNotificationUseCase(userRepo, outboxRepo, emailSender, config, settingsRepo, queuePublisher);

    // Should NOT throw
    await useCase.execute('tenant-1', 'Demo Business', REQUEST, correlationId);
  });

  // ── Destination + Queue Publishing tests ───────────────────────

  it('populates destination on email outbox = owner.email', async () => {
    await useCase.execute('tenant-1', 'Demo Business', REQUEST, correlationId);

    const emailRecord = outboxRepo.created.find((r) => r.channel === 'email');
    expect(emailRecord!.destination).toBe('owner@example.com');
  });

  it('resolves SMS destination from BusinessSettings.phone and publishes sms.send job', async () => {
    await useCase.execute('tenant-1', 'Demo Business', REQUEST, correlationId);

    const smsRecord = outboxRepo.created.find((r) => r.channel === 'sms');
    expect(smsRecord!.destination).toBe('+15559999999');

    expect(queuePublisher.publish).toHaveBeenCalledWith(expect.objectContaining({
      jobType: 'sms.send',
      outboxId: smsRecord!.id,
      tenantId: 'tenant-1',
      correlationId,
    }));
  });

  it('when phone is null, creates SMS outbox with destination=null but does NOT publish', async () => {
    settingsRepo = makeSettingsRepo(null);
    useCase = new SendRequestNotificationUseCase(userRepo, outboxRepo, emailSender, config, settingsRepo, queuePublisher);

    await useCase.execute('tenant-1', 'Demo Business', REQUEST, correlationId);

    const smsRecord = outboxRepo.created.find((r) => r.channel === 'sms');
    expect(smsRecord!.destination).toBeNull();

    expect(queuePublisher.publish).not.toHaveBeenCalled();
  });
});
