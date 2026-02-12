import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SendQuoteUseCase } from '../../src/application/usecases/send-quote.js';
import type { QuoteRepository } from '../../src/application/ports/quote-repository.js';
import type { UnitOfWork, TransactionRepos } from '../../src/application/ports/unit-of-work.js';
import type { EmailSender } from '../../src/application/ports/email-sender.js';
import type { MessageOutboxRepository } from '../../src/application/ports/message-outbox-repository.js';
import type { ClientRepository } from '../../src/application/ports/client-repository.js';
import type { AppConfig } from '../../src/shared/config.js';
import type { Quote } from '../../src/domain/entities/quote.js';
import { hashToken } from '../../src/shared/crypto.js';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000010';
const QUOTE_ID = '00000000-0000-0000-0000-000000000700';
const CLIENT_ID = '00000000-0000-0000-0000-000000000400';

function makeDraftQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: QUOTE_ID,
    tenantId: TENANT_ID,
    requestId: null,
    clientId: CLIENT_ID,
    propertyId: null,
    title: 'Test Quote',
    lineItems: [{ serviceItemId: null, description: 'Mowing', quantity: 1, unitPrice: 5000, total: 5000 }],
    subtotal: 5000,
    tax: 0,
    total: 5000,
    status: 'draft',
    sentAt: null,
    approvedAt: null,
    declinedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeConfig(): AppConfig {
  return {
    DATABASE_URL: 'test',
    API_PORT: 4000,
    NODE_ENV: 'test',
    AUTH_MODE: 'local',
    DEV_AUTH_TENANT_ID: TENANT_ID,
    DEV_AUTH_USER_ID: USER_ID,
    DEV_AUTH_ROLE: 'owner',
    NOTIFICATION_ENABLED: true,
    SMTP_HOST: 'localhost',
    SMTP_PORT: 1025,
    SMTP_FROM: 'test@seedling.local',
    APP_BASE_URL: 'http://localhost:5173',
    SECURE_LINK_HMAC_SECRET: 'test-secret',
    COGNITO_USER_POOL_ID: '',
    COGNITO_CLIENT_ID: '',
    COGNITO_REGION: '',
  };
}

describe('SendQuoteUseCase', () => {
  let quoteRepo: QuoteRepository;
  let uow: UnitOfWork;
  let emailSender: EmailSender;
  let outboxRepo: MessageOutboxRepository;
  let clientRepo: ClientRepository;
  let config: AppConfig;
  let txRepos: TransactionRepos;

  beforeEach(() => {
    txRepos = {
      tenantRepo: {} as never,
      userRepo: {} as never,
      auditRepo: { record: vi.fn().mockResolvedValue(undefined), listBySubjects: vi.fn().mockResolvedValue({ data: [], cursor: null, hasMore: false }) },
      clientRepo: {} as never,
      propertyRepo: {} as never,
      requestRepo: {} as never,
      quoteRepo: {
        updateStatus: vi.fn().mockResolvedValue(makeDraftQuote({ status: 'sent', sentAt: new Date() })),
      } as never,
      secureLinkTokenRepo: {
        create: vi.fn().mockResolvedValue({}),
      } as never,
      jobRepo: {} as any,
      visitRepo: {} as any,
    };

    quoteRepo = {
      getById: vi.fn().mockResolvedValue(makeDraftQuote()),
      create: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
      count: vi.fn(),
      countByStatus: vi.fn(),
    };

    uow = {
      run: vi.fn().mockImplementation(async (fn) => fn(txRepos)),
    };

    emailSender = {
      send: vi.fn().mockResolvedValue({ messageId: 'msg-123' }),
    };

    outboxRepo = {
      create: vi.fn().mockResolvedValue({}),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    };

    clientRepo = {
      getById: vi.fn().mockResolvedValue({
        id: CLIENT_ID,
        tenantId: TENANT_ID,
        firstName: 'John',
        lastName: 'Smith',
        email: 'john@example.com',
        phone: null,
        company: null,
        notes: null,
        tags: [],
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    } as unknown as ClientRepository;

    config = makeConfig();
  });

  function makeUseCase() {
    return new SendQuoteUseCase(quoteRepo, uow, emailSender, outboxRepo, clientRepo, config);
  }

  it('sends a draft quote successfully', async () => {
    const uc = makeUseCase();
    const result = await uc.execute(
      { tenantId: TENANT_ID, userId: USER_ID, quoteId: QUOTE_ID },
      'corr-1',
    );

    expect(result.quote.status).toBe('sent');
    expect(result.token).toBeTruthy();
    expect(result.link).toContain('/quote/');
    expect(result.link).toContain(result.token);
  });

  it('returns a link with APP_BASE_URL prefix', async () => {
    const uc = makeUseCase();
    const result = await uc.execute(
      { tenantId: TENANT_ID, userId: USER_ID, quoteId: QUOTE_ID },
      'corr-1',
    );

    expect(result.link).toBe(`http://localhost:5173/quote/${result.token}`);
  });

  it('creates a hashed token (not raw)', async () => {
    const uc = makeUseCase();
    const result = await uc.execute(
      { tenantId: TENANT_ID, userId: USER_ID, quoteId: QUOTE_ID },
      'corr-1',
    );

    const createCall = (txRepos.secureLinkTokenRepo.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(createCall.tokenHash).not.toBe(result.token);
    expect(createCall.tokenHash).toBe(hashToken('test-secret', result.token));
  });

  it('records quote.sent audit event', async () => {
    const uc = makeUseCase();
    await uc.execute(
      { tenantId: TENANT_ID, userId: USER_ID, quoteId: QUOTE_ID },
      'corr-1',
    );

    expect(txRepos.auditRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'quote.sent',
        subjectType: 'quote',
        subjectId: QUOTE_ID,
        principalType: 'internal',
        principalId: USER_ID,
      }),
    );
  });

  it('creates email outbox record', async () => {
    const uc = makeUseCase();
    await uc.execute(
      { tenantId: TENANT_ID, userId: USER_ID, quoteId: QUOTE_ID },
      'corr-1',
    );

    expect(outboxRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'quote_sent',
        channel: 'email',
        recipientType: 'client',
        status: 'queued',
      }),
    );
  });

  it('throws NotFoundError when quote does not exist', async () => {
    (quoteRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const uc = makeUseCase();

    await expect(
      uc.execute({ tenantId: TENANT_ID, userId: USER_ID, quoteId: QUOTE_ID }, 'corr-1'),
    ).rejects.toThrow('Quote not found');
  });

  it('throws ValidationError for non-draft status (sent)', async () => {
    (quoteRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeDraftQuote({ status: 'sent' }),
    );
    const uc = makeUseCase();

    await expect(
      uc.execute({ tenantId: TENANT_ID, userId: USER_ID, quoteId: QUOTE_ID }, 'corr-1'),
    ).rejects.toThrow('Cannot send a quote with status "sent"');
  });

  it('throws ValidationError for non-draft status (approved)', async () => {
    (quoteRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeDraftQuote({ status: 'approved' }),
    );
    const uc = makeUseCase();

    await expect(
      uc.execute({ tenantId: TENANT_ID, userId: USER_ID, quoteId: QUOTE_ID }, 'corr-1'),
    ).rejects.toThrow('Cannot send a quote with status "approved"');
  });

  it('throws ValidationError when line items are empty', async () => {
    (quoteRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeDraftQuote({ lineItems: [] }),
    );
    const uc = makeUseCase();

    await expect(
      uc.execute({ tenantId: TENANT_ID, userId: USER_ID, quoteId: QUOTE_ID }, 'corr-1'),
    ).rejects.toThrow('Cannot send a quote with no line items');
  });

  it('throws ConflictError on race condition (updateStatus returns null)', async () => {
    (txRepos.quoteRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const uc = makeUseCase();

    await expect(
      uc.execute({ tenantId: TENANT_ID, userId: USER_ID, quoteId: QUOTE_ID }, 'corr-1'),
    ).rejects.toThrow('Quote has already been sent');
  });

  it('does not throw when email sending fails', async () => {
    (emailSender.send as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('SMTP down'));
    const uc = makeUseCase();

    const result = await uc.execute(
      { tenantId: TENANT_ID, userId: USER_ID, quoteId: QUOTE_ID },
      'corr-1',
    );

    expect(result.quote.status).toBe('sent');
    expect(outboxRepo.updateStatus).toHaveBeenCalledWith(
      expect.any(String),
      'failed',
      expect.objectContaining({ lastErrorMessage: 'SMTP down' }),
    );
  });

  it('creates token with quote:read scope', async () => {
    const uc = makeUseCase();
    await uc.execute(
      { tenantId: TENANT_ID, userId: USER_ID, quoteId: QUOTE_ID },
      'corr-1',
    );

    const createCall = (txRepos.secureLinkTokenRepo.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(createCall.scopes).toEqual(['quote:read', 'quote:respond']);
    expect(createCall.subjectType).toBe('quote');
    expect(createCall.subjectId).toBe(QUOTE_ID);
  });

  it('uses custom expiresInDays when provided', async () => {
    const uc = makeUseCase();
    await uc.execute(
      { tenantId: TENANT_ID, userId: USER_ID, quoteId: QUOTE_ID, expiresInDays: 7 },
      'corr-1',
    );

    const createCall = (txRepos.secureLinkTokenRepo.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const expectedExpiry = new Date();
    expectedExpiry.setDate(expectedExpiry.getDate() + 7);
    // Within 2 seconds tolerance
    expect(Math.abs(createCall.expiresAt.getTime() - expectedExpiry.getTime())).toBeLessThan(2000);
  });
});
