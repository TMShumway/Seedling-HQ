import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RespondToQuoteUseCase } from '../../src/application/usecases/respond-to-quote.js';
import type { QuoteRepository } from '../../src/application/ports/quote-repository.js';
import type { AuditEventRepository } from '../../src/application/ports/audit-event-repository.js';
import type { UserRepository } from '../../src/application/ports/user-repository.js';
import type { MessageOutboxRepository } from '../../src/application/ports/message-outbox-repository.js';
import type { EmailSender } from '../../src/application/ports/email-sender.js';
import type { AppConfig } from '../../src/shared/config.js';
import type { Quote } from '../../src/domain/entities/quote.js';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const QUOTE_ID = '00000000-0000-0000-0000-000000000700';
const TOKEN_ID = '00000000-0000-0000-0000-000000000800';

function makeSentQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: QUOTE_ID,
    tenantId: TENANT_ID,
    requestId: null,
    clientId: '00000000-0000-0000-0000-000000000400',
    propertyId: null,
    title: 'Test Quote',
    lineItems: [{ serviceItemId: null, description: 'Mowing', quantity: 1, unitPrice: 5000, total: 5000 }],
    subtotal: 5000,
    tax: 0,
    total: 5000,
    status: 'sent',
    sentAt: new Date('2026-01-15'),
    approvedAt: null,
    declinedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-15'),
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
    DEV_AUTH_USER_ID: '00000000-0000-0000-0000-000000000010',
    DEV_AUTH_ROLE: 'owner',
    NOTIFICATION_ENABLED: true,
    SMTP_HOST: 'localhost',
    SMTP_PORT: 1025,
    SMTP_FROM: 'test@seedling.local',
    APP_BASE_URL: 'http://localhost:5173',
    SECURE_LINK_HMAC_SECRET: 'test-secret',
  };
}

describe('RespondToQuoteUseCase', () => {
  let quoteRepo: QuoteRepository;
  let auditRepo: AuditEventRepository;
  let userRepo: UserRepository;
  let outboxRepo: MessageOutboxRepository;
  let emailSender: EmailSender;
  let config: AppConfig;

  beforeEach(() => {
    quoteRepo = {
      getById: vi.fn().mockResolvedValue(makeSentQuote()),
      updateStatus: vi.fn().mockImplementation((_tenantId, _id, status, statusFields) =>
        Promise.resolve(makeSentQuote({ status, ...statusFields })),
      ),
      create: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      countByStatus: vi.fn(),
    };

    auditRepo = {
      record: vi.fn().mockResolvedValue(undefined),
      listBySubjects: vi.fn(),
    };

    userRepo = {
      getOwnerByTenantId: vi.fn().mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000010',
        tenantId: TENANT_ID,
        email: 'owner@demo.local',
        fullName: 'Demo Owner',
        role: 'owner',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      create: vi.fn(),
      getById: vi.fn(),
      getByEmail: vi.fn(),
    };

    outboxRepo = {
      create: vi.fn().mockResolvedValue({}),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    };

    emailSender = {
      send: vi.fn().mockResolvedValue({ messageId: 'msg-123' }),
    };

    config = makeConfig();
  });

  function makeUseCase() {
    return new RespondToQuoteUseCase(quoteRepo, auditRepo, userRepo, outboxRepo, emailSender, config);
  }

  it('approves a sent quote', async () => {
    const uc = makeUseCase();
    const result = await uc.execute(
      { tenantId: TENANT_ID, quoteId: QUOTE_ID, tokenId: TOKEN_ID, action: 'approve' },
      'corr-1',
    );

    expect(result.quote.status).toBe('approved');
    expect(result.quote.approvedAt).toBeTruthy();
    expect(quoteRepo.updateStatus).toHaveBeenCalledWith(
      TENANT_ID, QUOTE_ID, 'approved',
      expect.objectContaining({ approvedAt: expect.any(Date) }),
      ['sent'],
    );
  });

  it('declines a sent quote', async () => {
    const uc = makeUseCase();
    const result = await uc.execute(
      { tenantId: TENANT_ID, quoteId: QUOTE_ID, tokenId: TOKEN_ID, action: 'decline' },
      'corr-1',
    );

    expect(result.quote.status).toBe('declined');
    expect(result.quote.declinedAt).toBeTruthy();
    expect(quoteRepo.updateStatus).toHaveBeenCalledWith(
      TENANT_ID, QUOTE_ID, 'declined',
      expect.objectContaining({ declinedAt: expect.any(Date) }),
      ['sent'],
    );
  });

  it('records quote.approved audit event with external principal', async () => {
    const uc = makeUseCase();
    await uc.execute(
      { tenantId: TENANT_ID, quoteId: QUOTE_ID, tokenId: TOKEN_ID, action: 'approve' },
      'corr-1',
    );

    expect(auditRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'quote.approved',
        principalType: 'external',
        principalId: TOKEN_ID,
        subjectType: 'quote',
        subjectId: QUOTE_ID,
      }),
    );
  });

  it('records quote.declined audit event', async () => {
    const uc = makeUseCase();
    await uc.execute(
      { tenantId: TENANT_ID, quoteId: QUOTE_ID, tokenId: TOKEN_ID, action: 'decline' },
      'corr-1',
    );

    expect(auditRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'quote.declined',
        principalType: 'external',
        principalId: TOKEN_ID,
      }),
    );
  });

  it('throws NotFoundError for missing quote', async () => {
    (quoteRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const uc = makeUseCase();

    await expect(
      uc.execute({ tenantId: TENANT_ID, quoteId: QUOTE_ID, tokenId: TOKEN_ID, action: 'approve' }, 'corr-1'),
    ).rejects.toThrow('Quote not found');
  });

  it('throws ValidationError for draft quote', async () => {
    (quoteRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSentQuote({ status: 'draft', sentAt: null }),
    );
    const uc = makeUseCase();

    await expect(
      uc.execute({ tenantId: TENANT_ID, quoteId: QUOTE_ID, tokenId: TOKEN_ID, action: 'approve' }, 'corr-1'),
    ).rejects.toThrow('Only sent quotes can be approved');
  });

  it('throws ValidationError for expired quote', async () => {
    (quoteRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSentQuote({ status: 'expired' }),
    );
    const uc = makeUseCase();

    await expect(
      uc.execute({ tenantId: TENANT_ID, quoteId: QUOTE_ID, tokenId: TOKEN_ID, action: 'decline' }, 'corr-1'),
    ).rejects.toThrow('Only sent quotes can be declined');
  });

  it('returns current state for idempotent approve (already approved)', async () => {
    const approvedAt = new Date('2026-01-20');
    (quoteRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSentQuote({ status: 'approved', approvedAt }),
    );
    const uc = makeUseCase();

    const result = await uc.execute(
      { tenantId: TENANT_ID, quoteId: QUOTE_ID, tokenId: TOKEN_ID, action: 'approve' },
      'corr-1',
    );

    expect(result.quote.status).toBe('approved');
    expect(result.quote.approvedAt).toBe(approvedAt.toISOString());
    expect(quoteRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('returns current state for idempotent decline (already declined)', async () => {
    const declinedAt = new Date('2026-01-20');
    (quoteRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSentQuote({ status: 'declined', declinedAt }),
    );
    const uc = makeUseCase();

    const result = await uc.execute(
      { tenantId: TENANT_ID, quoteId: QUOTE_ID, tokenId: TOKEN_ID, action: 'decline' },
      'corr-1',
    );

    expect(result.quote.status).toBe('declined');
    expect(result.quote.declinedAt).toBe(declinedAt.toISOString());
    expect(quoteRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('throws ValidationError for cross-transition: approve already-declined', async () => {
    (quoteRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSentQuote({ status: 'declined', declinedAt: new Date() }),
    );
    const uc = makeUseCase();

    await expect(
      uc.execute({ tenantId: TENANT_ID, quoteId: QUOTE_ID, tokenId: TOKEN_ID, action: 'approve' }, 'corr-1'),
    ).rejects.toThrow('This quote has already been declined');
  });

  it('throws ValidationError for cross-transition: decline already-approved', async () => {
    (quoteRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSentQuote({ status: 'approved', approvedAt: new Date() }),
    );
    const uc = makeUseCase();

    await expect(
      uc.execute({ tenantId: TENANT_ID, quoteId: QUOTE_ID, tokenId: TOKEN_ID, action: 'decline' }, 'corr-1'),
    ).rejects.toThrow('This quote has already been approved');
  });

  it('does not throw when notification fails', async () => {
    (emailSender.send as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('SMTP down'));
    const uc = makeUseCase();

    const result = await uc.execute(
      { tenantId: TENANT_ID, quoteId: QUOTE_ID, tokenId: TOKEN_ID, action: 'approve' },
      'corr-1',
    );

    expect(result.quote.status).toBe('approved');
  });
});
