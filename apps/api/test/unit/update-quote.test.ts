import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateQuoteUseCase } from '../../src/application/usecases/update-quote.js';
import type { QuoteRepository } from '../../src/application/ports/quote-repository.js';
import type {
  AuditEventRepository,
  AuditEvent,
} from '../../src/application/ports/audit-event-repository.js';
import type { Quote, QuoteLineItem } from '../../src/domain/entities/quote.js';
import { ValidationError, NotFoundError } from '../../src/shared/errors.js';

function makeDraftQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 'quote-1',
    tenantId: 'tenant-1',
    requestId: null,
    clientId: 'client-1',
    propertyId: null,
    title: 'Original Quote',
    lineItems: [],
    subtotal: 0,
    tax: 0,
    total: 0,
    status: 'draft',
    sentAt: null,
    approvedAt: null,
    declinedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeQuoteRepo(overrides: Partial<QuoteRepository> = {}): QuoteRepository {
  return {
    create: vi.fn(async (q) => ({ ...q, createdAt: new Date(), updatedAt: new Date() })),
    getById: vi.fn(async () => makeDraftQuote()),
    list: vi.fn(async () => ({ data: [], cursor: null, hasMore: false })),
    update: vi.fn(async (_tenantId, _id, patch) => makeDraftQuote({ ...patch, updatedAt: new Date() })),
    updateStatus: vi.fn(async () => null),
    count: vi.fn(async () => 0),
    countByStatus: vi.fn(async () => 0),
    ...overrides,
  };
}

function makeAuditRepo(): AuditEventRepository & { recorded: AuditEvent[] } {
  const recorded: AuditEvent[] = [];
  return {
    recorded,
    record: vi.fn(async (e) => {
      const event = { ...e, createdAt: new Date() };
      recorded.push(event);
      return event;
    }),
    listBySubjects: vi.fn(async () => ({ data: [], cursor: null, hasMore: false })),
  };
}

const correlationId = 'corr-test';

describe('UpdateQuoteUseCase', () => {
  let quoteRepo: QuoteRepository;
  let auditRepo: ReturnType<typeof makeAuditRepo>;
  let useCase: UpdateQuoteUseCase;

  beforeEach(() => {
    quoteRepo = makeQuoteRepo();
    auditRepo = makeAuditRepo();
    useCase = new UpdateQuoteUseCase(quoteRepo, auditRepo);
  });

  it('updates title and records audit event', async () => {
    const result = await useCase.execute(
      { tenantId: 'tenant-1', userId: 'user-1', id: 'quote-1', title: 'New Title' },
      correlationId,
    );

    expect(result.quote).toBeDefined();
    expect(quoteRepo.update).toHaveBeenCalledOnce();
    expect(auditRepo.recorded).toHaveLength(1);
    expect(auditRepo.recorded[0].eventName).toBe('quote.updated');
    expect(auditRepo.recorded[0].subjectType).toBe('quote');
    expect(auditRepo.recorded[0].subjectId).toBe('quote-1');
  });

  it('computes line item total = quantity * unitPrice', async () => {
    const lineItems: QuoteLineItem[] = [
      { serviceItemId: null, description: 'Mowing', quantity: 2, unitPrice: 4500, total: 0 },
    ];

    await useCase.execute(
      { tenantId: 'tenant-1', userId: 'user-1', id: 'quote-1', lineItems },
      correlationId,
    );

    const call = vi.mocked(quoteRepo.update).mock.calls[0];
    const patch = call[2];
    expect(patch.lineItems![0].total).toBe(9000);
  });

  it('computes subtotal as sum of line item totals', async () => {
    const lineItems: QuoteLineItem[] = [
      { serviceItemId: null, description: 'Mowing', quantity: 1, unitPrice: 4500, total: 0 },
      { serviceItemId: null, description: 'Edging', quantity: 1, unitPrice: 2500, total: 0 },
    ];

    await useCase.execute(
      { tenantId: 'tenant-1', userId: 'user-1', id: 'quote-1', lineItems },
      correlationId,
    );

    const call = vi.mocked(quoteRepo.update).mock.calls[0];
    const patch = call[2];
    expect(patch.subtotal).toBe(7000);
    expect(patch.total).toBe(7000); // no tax
  });

  it('computes total = subtotal + tax when both provided', async () => {
    const lineItems: QuoteLineItem[] = [
      { serviceItemId: null, description: 'Mowing', quantity: 1, unitPrice: 10000, total: 0 },
    ];

    await useCase.execute(
      { tenantId: 'tenant-1', userId: 'user-1', id: 'quote-1', lineItems, tax: 500 },
      correlationId,
    );

    const call = vi.mocked(quoteRepo.update).mock.calls[0];
    const patch = call[2];
    expect(patch.subtotal).toBe(10000);
    expect(patch.tax).toBe(500);
    expect(patch.total).toBe(10500);
  });

  it('rejects non-draft quote (sent)', async () => {
    quoteRepo = makeQuoteRepo({
      getById: vi.fn(async () => makeDraftQuote({ status: 'sent' })),
    });
    useCase = new UpdateQuoteUseCase(quoteRepo, auditRepo);

    await expect(
      useCase.execute(
        { tenantId: 'tenant-1', userId: 'user-1', id: 'quote-1', title: 'X' },
        correlationId,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects non-draft quote (approved)', async () => {
    quoteRepo = makeQuoteRepo({
      getById: vi.fn(async () => makeDraftQuote({ status: 'approved' })),
    });
    useCase = new UpdateQuoteUseCase(quoteRepo, auditRepo);

    await expect(
      useCase.execute(
        { tenantId: 'tenant-1', userId: 'user-1', id: 'quote-1', title: 'X' },
        correlationId,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('throws NotFoundError when quote does not exist', async () => {
    quoteRepo = makeQuoteRepo({
      getById: vi.fn(async () => null),
    });
    useCase = new UpdateQuoteUseCase(quoteRepo, auditRepo);

    await expect(
      useCase.execute(
        { tenantId: 'tenant-1', userId: 'user-1', id: 'missing', title: 'X' },
        correlationId,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ValidationError for empty title', async () => {
    await expect(
      useCase.execute(
        { tenantId: 'tenant-1', userId: 'user-1', id: 'quote-1', title: '   ' },
        correlationId,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for empty line item description', async () => {
    const lineItems: QuoteLineItem[] = [
      { serviceItemId: null, description: '', quantity: 1, unitPrice: 100, total: 0 },
    ];

    await expect(
      useCase.execute(
        { tenantId: 'tenant-1', userId: 'user-1', id: 'quote-1', lineItems },
        correlationId,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for quantity <= 0', async () => {
    const lineItems: QuoteLineItem[] = [
      { serviceItemId: null, description: 'Mowing', quantity: 0, unitPrice: 100, total: 0 },
    ];

    await expect(
      useCase.execute(
        { tenantId: 'tenant-1', userId: 'user-1', id: 'quote-1', lineItems },
        correlationId,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for negative unitPrice', async () => {
    const lineItems: QuoteLineItem[] = [
      { serviceItemId: null, description: 'Mowing', quantity: 1, unitPrice: -100, total: 0 },
    ];

    await expect(
      useCase.execute(
        { tenantId: 'tenant-1', userId: 'user-1', id: 'quote-1', lineItems },
        correlationId,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for negative tax', async () => {
    await expect(
      useCase.execute(
        { tenantId: 'tenant-1', userId: 'user-1', id: 'quote-1', tax: -100 },
        correlationId,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('rounds totals for fractional quantities', async () => {
    const lineItems: QuoteLineItem[] = [
      { serviceItemId: null, description: 'Hourly labor', quantity: 1.5, unitPrice: 3333, total: 0 },
    ];

    await useCase.execute(
      { tenantId: 'tenant-1', userId: 'user-1', id: 'quote-1', lineItems },
      correlationId,
    );

    const call = vi.mocked(quoteRepo.update).mock.calls[0];
    const patch = call[2];
    // 1.5 * 3333 = 4999.5 → should round to 5000
    expect(patch.lineItems![0].total).toBe(5000);
    expect(Number.isInteger(patch.subtotal)).toBe(true);
    expect(patch.subtotal).toBe(5000);
  });

  it('allows partial update (title only)', async () => {
    await useCase.execute(
      { tenantId: 'tenant-1', userId: 'user-1', id: 'quote-1', title: 'Just Title' },
      correlationId,
    );

    const call = vi.mocked(quoteRepo.update).mock.calls[0];
    const patch = call[2];
    expect(patch.title).toBe('Just Title');
    expect(patch.lineItems).toBeUndefined();
    expect(patch.tax).toBeUndefined();
  });

  it('records correct audit event fields', async () => {
    await useCase.execute(
      { tenantId: 'tenant-1', userId: 'user-1', id: 'quote-1', title: 'Audit Check' },
      correlationId,
    );

    expect(auditRepo.recorded[0].tenantId).toBe('tenant-1');
    expect(auditRepo.recorded[0].principalType).toBe('internal');
    expect(auditRepo.recorded[0].principalId).toBe('user-1');
    expect(auditRepo.recorded[0].correlationId).toBe('corr-test');
  });
});
