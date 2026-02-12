import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateJobFromQuoteUseCase } from '../../src/application/usecases/create-job-from-quote.js';
import type { QuoteRepository } from '../../src/application/ports/quote-repository.js';
import type { JobRepository } from '../../src/application/ports/job-repository.js';
import type { VisitRepository } from '../../src/application/ports/visit-repository.js';
import type { ServiceItemRepository } from '../../src/application/ports/service-item-repository.js';
import type { UnitOfWork, TransactionRepos } from '../../src/application/ports/unit-of-work.js';
import type { Quote } from '../../src/domain/entities/quote.js';
import type { Job } from '../../src/domain/entities/job.js';
import type { Visit } from '../../src/domain/entities/visit.js';
import type { ServiceItem } from '../../src/domain/entities/service-item.js';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000010';
const QUOTE_ID = '00000000-0000-0000-0000-000000000700';
const CLIENT_ID = '00000000-0000-0000-0000-000000000400';
const PROPERTY_ID = '00000000-0000-0000-0000-000000000500';

function makeApprovedQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: QUOTE_ID,
    tenantId: TENANT_ID,
    requestId: null,
    clientId: CLIENT_ID,
    propertyId: PROPERTY_ID,
    title: 'Test Quote',
    lineItems: [
      { serviceItemId: '00000000-0000-0000-0000-000000000300', description: 'Mowing', quantity: 1, unitPrice: 4500, total: 4500 },
      { serviceItemId: '00000000-0000-0000-0000-000000000301', description: 'Edging', quantity: 1, unitPrice: 2500, total: 2500 },
    ],
    subtotal: 7000,
    tax: 0,
    total: 7000,
    status: 'approved',
    sentAt: new Date('2026-01-01'),
    approvedAt: new Date('2026-01-02'),
    declinedAt: null,
    scheduledAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    ...overrides,
  };
}

function makeServiceItem(id: string, duration: number | null): ServiceItem {
  return {
    id,
    tenantId: TENANT_ID,
    categoryId: '00000000-0000-0000-0000-000000000200',
    name: 'Test Service',
    description: null,
    unitPrice: 4500,
    unitType: 'per_visit',
    estimatedDurationMinutes: duration,
    active: true,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('CreateJobFromQuoteUseCase', () => {
  let quoteRepo: QuoteRepository;
  let jobRepo: JobRepository;
  let visitRepo: VisitRepository;
  let serviceItemRepo: ServiceItemRepository;
  let uow: UnitOfWork;
  let txRepos: TransactionRepos;
  let useCase: CreateJobFromQuoteUseCase;

  beforeEach(() => {
    quoteRepo = {
      getById: vi.fn(),
      create: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
      count: vi.fn(),
      countByStatus: vi.fn(),
    };

    jobRepo = {
      create: vi.fn(),
      getById: vi.fn(),
      getByQuoteId: vi.fn(),
      list: vi.fn(),
      count: vi.fn(),
      countByStatus: vi.fn(),
    };

    visitRepo = {
      create: vi.fn(),
      getById: vi.fn(),
      listByJobId: vi.fn(),
    };

    serviceItemRepo = {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deactivate: vi.fn(),
      deactivateByCategoryId: vi.fn(),
      countByCategoryId: vi.fn(),
    };

    txRepos = {
      tenantRepo: {} as any,
      userRepo: {} as any,
      auditRepo: { record: vi.fn() },
      clientRepo: {} as any,
      propertyRepo: {} as any,
      requestRepo: {} as any,
      quoteRepo: { updateStatus: vi.fn() },
      secureLinkTokenRepo: {} as any,
      jobRepo: { create: vi.fn() },
      visitRepo: { create: vi.fn() },
    } as TransactionRepos;

    uow = {
      run: vi.fn(async (fn) => fn(txRepos)),
    };

    useCase = new CreateJobFromQuoteUseCase(quoteRepo, jobRepo, visitRepo, serviceItemRepo, uow);
  });

  it('creates job + visit from approved quote', async () => {
    const quote = makeApprovedQuote();
    (quoteRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(quote);
    (serviceItemRepo.getById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(makeServiceItem('00000000-0000-0000-0000-000000000300', 45))
      .mockResolvedValueOnce(makeServiceItem('00000000-0000-0000-0000-000000000301', 30));

    const updatedQuote = { ...quote, status: 'scheduled', scheduledAt: new Date() };
    (txRepos.quoteRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(updatedQuote);
    (txRepos.jobRepo.create as ReturnType<typeof vi.fn>).mockImplementation(async (j) => ({ ...j, createdAt: new Date(), updatedAt: new Date() }));
    (txRepos.visitRepo.create as ReturnType<typeof vi.fn>).mockImplementation(async (v) => ({ ...v, createdAt: new Date(), updatedAt: new Date() }));

    const result = await useCase.execute({ tenantId: TENANT_ID, userId: USER_ID, quoteId: QUOTE_ID }, 'corr-1');

    expect(result.alreadyExisted).toBe(false);
    expect(result.job.tenantId).toBe(TENANT_ID);
    expect(result.job.quoteId).toBe(QUOTE_ID);
    expect(result.job.clientId).toBe(CLIENT_ID);
    expect(result.job.propertyId).toBe(PROPERTY_ID);
    expect(result.job.title).toBe('Test Quote');
    expect(result.job.status).toBe('scheduled');
    expect(result.visit.jobId).toBe(result.job.id);
    expect(result.visit.status).toBe('scheduled');
    expect(result.suggestedDurationMinutes).toBe(75); // 45 + 30
    expect(result.quote.status).toBe('scheduled');
  });

  it('calculates duration with default 60 when no service items have durations', async () => {
    const quote = makeApprovedQuote({
      lineItems: [
        { serviceItemId: null, description: 'Custom work', quantity: 1, unitPrice: 5000, total: 5000 },
      ],
    });
    (quoteRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(quote);

    const updatedQuote = { ...quote, status: 'scheduled', scheduledAt: new Date() };
    (txRepos.quoteRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(updatedQuote);
    (txRepos.jobRepo.create as ReturnType<typeof vi.fn>).mockImplementation(async (j) => ({ ...j, createdAt: new Date(), updatedAt: new Date() }));
    (txRepos.visitRepo.create as ReturnType<typeof vi.fn>).mockImplementation(async (v) => ({ ...v, createdAt: new Date(), updatedAt: new Date() }));

    const result = await useCase.execute({ tenantId: TENANT_ID, userId: USER_ID, quoteId: QUOTE_ID }, 'corr-1');
    expect(result.suggestedDurationMinutes).toBe(60);
  });

  it('defaults duration to 60 when service items have null durations', async () => {
    const quote = makeApprovedQuote({
      lineItems: [
        { serviceItemId: '00000000-0000-0000-0000-000000000305', description: 'Mulch', quantity: 200, unitPrice: 350, total: 70000 },
      ],
    });
    (quoteRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(quote);
    (serviceItemRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeServiceItem('00000000-0000-0000-0000-000000000305', null));

    const updatedQuote = { ...quote, status: 'scheduled', scheduledAt: new Date() };
    (txRepos.quoteRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(updatedQuote);
    (txRepos.jobRepo.create as ReturnType<typeof vi.fn>).mockImplementation(async (j) => ({ ...j, createdAt: new Date(), updatedAt: new Date() }));
    (txRepos.visitRepo.create as ReturnType<typeof vi.fn>).mockImplementation(async (v) => ({ ...v, createdAt: new Date(), updatedAt: new Date() }));

    const result = await useCase.execute({ tenantId: TENANT_ID, userId: USER_ID, quoteId: QUOTE_ID }, 'corr-1');
    expect(result.suggestedDurationMinutes).toBe(60);
  });

  it('calculates mixed null and non-null durations correctly', async () => {
    const quote = makeApprovedQuote({
      lineItems: [
        { serviceItemId: '00000000-0000-0000-0000-000000000300', description: 'Mowing', quantity: 1, unitPrice: 4500, total: 4500 },
        { serviceItemId: '00000000-0000-0000-0000-000000000305', description: 'Mulch', quantity: 200, unitPrice: 350, total: 70000 },
      ],
    });
    (quoteRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(quote);
    (serviceItemRepo.getById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(makeServiceItem('00000000-0000-0000-0000-000000000300', 45))
      .mockResolvedValueOnce(makeServiceItem('00000000-0000-0000-0000-000000000305', null));

    const updatedQuote = { ...quote, status: 'scheduled', scheduledAt: new Date() };
    (txRepos.quoteRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(updatedQuote);
    (txRepos.jobRepo.create as ReturnType<typeof vi.fn>).mockImplementation(async (j) => ({ ...j, createdAt: new Date(), updatedAt: new Date() }));
    (txRepos.visitRepo.create as ReturnType<typeof vi.fn>).mockImplementation(async (v) => ({ ...v, createdAt: new Date(), updatedAt: new Date() }));

    const result = await useCase.execute({ tenantId: TENANT_ID, userId: USER_ID, quoteId: QUOTE_ID }, 'corr-1');
    expect(result.suggestedDurationMinutes).toBe(45); // only the one with a value
  });

  it('returns idempotent response when quote is already scheduled', async () => {
    const quote = makeApprovedQuote({ status: 'scheduled', scheduledAt: new Date() });
    const existingJob: Job = {
      id: '00000000-0000-0000-0000-000000000900',
      tenantId: TENANT_ID,
      quoteId: QUOTE_ID,
      clientId: CLIENT_ID,
      propertyId: PROPERTY_ID,
      title: 'Test Quote',
      status: 'scheduled',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const existingVisit: Visit = {
      id: '00000000-0000-0000-0000-000000000950',
      tenantId: TENANT_ID,
      jobId: existingJob.id,
      assignedUserId: null,
      scheduledStart: null,
      scheduledEnd: null,
      estimatedDurationMinutes: 75,
      status: 'scheduled',
      notes: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (quoteRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(quote);
    (jobRepo.getByQuoteId as ReturnType<typeof vi.fn>).mockResolvedValue(existingJob);
    (visitRepo.listByJobId as ReturnType<typeof vi.fn>).mockResolvedValue([existingVisit]);

    const result = await useCase.execute({ tenantId: TENANT_ID, userId: USER_ID, quoteId: QUOTE_ID }, 'corr-1');

    expect(result.alreadyExisted).toBe(true);
    expect(result.job.id).toBe(existingJob.id);
    expect(result.visit.id).toBe(existingVisit.id);
    expect(uow.run).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when quote does not exist', async () => {
    (quoteRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      useCase.execute({ tenantId: TENANT_ID, userId: USER_ID, quoteId: QUOTE_ID }, 'corr-1'),
    ).rejects.toThrow('Quote not found');
  });

  it('throws ValidationError for draft quote', async () => {
    const quote = makeApprovedQuote({ status: 'draft' });
    (quoteRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(quote);

    await expect(
      useCase.execute({ tenantId: TENANT_ID, userId: USER_ID, quoteId: QUOTE_ID }, 'corr-1'),
    ).rejects.toThrow('Cannot create job from quote with status "draft"');
  });

  it('throws ValidationError for sent quote', async () => {
    const quote = makeApprovedQuote({ status: 'sent' });
    (quoteRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(quote);

    await expect(
      useCase.execute({ tenantId: TENANT_ID, userId: USER_ID, quoteId: QUOTE_ID }, 'corr-1'),
    ).rejects.toThrow('Cannot create job from quote with status "sent"');
  });

  it('throws ValidationError for declined quote', async () => {
    const quote = makeApprovedQuote({ status: 'declined', declinedAt: new Date() });
    (quoteRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(quote);

    await expect(
      useCase.execute({ tenantId: TENANT_ID, userId: USER_ID, quoteId: QUOTE_ID }, 'corr-1'),
    ).rejects.toThrow('Cannot create job from quote with status "declined"');
  });

  it('throws ConflictError when race condition loses (updateStatus returns null)', async () => {
    const quote = makeApprovedQuote();
    (quoteRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(quote);
    (serviceItemRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeServiceItem('00000000-0000-0000-0000-000000000300', 45));

    (txRepos.quoteRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      useCase.execute({ tenantId: TENANT_ID, userId: USER_ID, quoteId: QUOTE_ID }, 'corr-1'),
    ).rejects.toThrow('Quote has already been transitioned');
  });

  it('records 3 audit events', async () => {
    const quote = makeApprovedQuote();
    (quoteRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(quote);
    (serviceItemRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeServiceItem('00000000-0000-0000-0000-000000000300', 45));

    const updatedQuote = { ...quote, status: 'scheduled', scheduledAt: new Date() };
    (txRepos.quoteRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(updatedQuote);
    (txRepos.jobRepo.create as ReturnType<typeof vi.fn>).mockImplementation(async (j) => ({ ...j, createdAt: new Date(), updatedAt: new Date() }));
    (txRepos.visitRepo.create as ReturnType<typeof vi.fn>).mockImplementation(async (v) => ({ ...v, createdAt: new Date(), updatedAt: new Date() }));

    await useCase.execute({ tenantId: TENANT_ID, userId: USER_ID, quoteId: QUOTE_ID }, 'corr-1');

    const auditCalls = (txRepos.auditRepo.record as ReturnType<typeof vi.fn>).mock.calls;
    expect(auditCalls).toHaveLength(3);
    expect(auditCalls[0][0].eventName).toBe('job.created');
    expect(auditCalls[1][0].eventName).toBe('visit.scheduled');
    expect(auditCalls[2][0].eventName).toBe('quote.scheduled');
  });

  it('handles unique violation with scoped idempotent return', async () => {
    const quote = makeApprovedQuote();
    (quoteRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(quote);
    (serviceItemRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeServiceItem('00000000-0000-0000-0000-000000000300', 45));

    // Simulate unique violation from UoW
    const uniqueViolation = Object.assign(new Error('unique_violation'), { code: '23505' });
    (uow.run as ReturnType<typeof vi.fn>).mockRejectedValue(uniqueViolation);

    // After catching the violation, lookup the existing job
    const existingJob: Job = {
      id: '00000000-0000-0000-0000-000000000900',
      tenantId: TENANT_ID,
      quoteId: QUOTE_ID,
      clientId: CLIENT_ID,
      propertyId: PROPERTY_ID,
      title: 'Test Quote',
      status: 'scheduled',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const existingVisit: Visit = {
      id: '00000000-0000-0000-0000-000000000950',
      tenantId: TENANT_ID,
      jobId: existingJob.id,
      assignedUserId: null,
      scheduledStart: null,
      scheduledEnd: null,
      estimatedDurationMinutes: 75,
      status: 'scheduled',
      notes: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const scheduledQuote = { ...quote, status: 'scheduled' as const, scheduledAt: new Date() };

    (jobRepo.getByQuoteId as ReturnType<typeof vi.fn>).mockResolvedValue(existingJob);
    // getById is called again after unique violation catch
    (quoteRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(scheduledQuote);
    (visitRepo.listByJobId as ReturnType<typeof vi.fn>).mockResolvedValue([existingVisit]);

    const result = await useCase.execute({ tenantId: TENANT_ID, userId: USER_ID, quoteId: QUOTE_ID }, 'corr-1');

    expect(result.alreadyExisted).toBe(true);
    expect(result.job.id).toBe(existingJob.id);
  });

  it('rethrows unique violation when no job found (unrelated constraint)', async () => {
    const quote = makeApprovedQuote();
    (quoteRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(quote);
    (serviceItemRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeServiceItem('00000000-0000-0000-0000-000000000300', 45));

    const uniqueViolation = Object.assign(new Error('unique_violation'), { code: '23505' });
    (uow.run as ReturnType<typeof vi.fn>).mockRejectedValue(uniqueViolation);
    (jobRepo.getByQuoteId as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      useCase.execute({ tenantId: TENANT_ID, userId: USER_ID, quoteId: QUOTE_ID }, 'corr-1'),
    ).rejects.toThrow('unique_violation');
  });

  it('throws ValidationError when scheduled but no job found', async () => {
    const quote = makeApprovedQuote({ status: 'scheduled', scheduledAt: new Date() });
    (quoteRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(quote);
    (jobRepo.getByQuoteId as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      useCase.execute({ tenantId: TENANT_ID, userId: USER_ID, quoteId: QUOTE_ID }, 'corr-1'),
    ).rejects.toThrow('Quote is in scheduled state but no job was found');
  });
});
