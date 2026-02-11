import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateStandaloneQuoteUseCase } from '../../src/application/usecases/create-quote.js';
import type { QuoteRepository } from '../../src/application/ports/quote-repository.js';
import type { ClientRepository } from '../../src/application/ports/client-repository.js';
import type { PropertyRepository } from '../../src/application/ports/property-repository.js';
import type {
  AuditEventRepository,
  AuditEvent,
} from '../../src/application/ports/audit-event-repository.js';
import type { Client } from '../../src/domain/entities/client.js';
import type { Property } from '../../src/domain/entities/property.js';
import { ValidationError, NotFoundError } from '../../src/shared/errors.js';

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    tenantId: 'tenant-1',
    firstName: 'John',
    lastName: 'Smith',
    email: 'john@example.com',
    phone: '555-1234',
    company: null,
    notes: null,
    tags: [],
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: 'prop-1',
    tenantId: 'tenant-1',
    clientId: 'client-1',
    addressLine1: '123 Main St',
    addressLine2: null,
    city: 'Springfield',
    state: 'IL',
    zip: '62701',
    notes: null,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeQuoteRepo(overrides: Partial<QuoteRepository> = {}): QuoteRepository {
  return {
    create: vi.fn(async (q) => ({ ...q, createdAt: new Date(), updatedAt: new Date() })),
    getById: vi.fn(async () => null),
    list: vi.fn(async () => ({ data: [], cursor: null, hasMore: false })),
    update: vi.fn(async () => null),
    updateStatus: vi.fn(async () => null),
    count: vi.fn(async () => 0),
    countByStatus: vi.fn(async () => 0),
    ...overrides,
  };
}

function makeClientRepo(overrides: Partial<ClientRepository> = {}): ClientRepository {
  return {
    getById: vi.fn(async () => makeClient()),
    list: vi.fn(async () => ({ data: [], cursor: null, hasMore: false })),
    create: vi.fn(async (c) => ({ ...c, createdAt: new Date(), updatedAt: new Date() })),
    update: vi.fn(async () => null),
    deactivate: vi.fn(async () => true),
    count: vi.fn(async () => 0),
    ...overrides,
  };
}

function makePropertyRepo(overrides: Partial<PropertyRepository> = {}): PropertyRepository {
  return {
    getById: vi.fn(async () => makeProperty()),
    listByClientId: vi.fn(async () => []),
    create: vi.fn(async (p) => ({ ...p, createdAt: new Date(), updatedAt: new Date() })),
    update: vi.fn(async () => null),
    deactivate: vi.fn(async () => true),
    deactivateByClientId: vi.fn(async () => 0),
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

describe('CreateStandaloneQuoteUseCase', () => {
  let quoteRepo: QuoteRepository;
  let clientRepo: ClientRepository;
  let propertyRepo: PropertyRepository;
  let auditRepo: ReturnType<typeof makeAuditRepo>;
  let useCase: CreateStandaloneQuoteUseCase;

  beforeEach(() => {
    quoteRepo = makeQuoteRepo();
    clientRepo = makeClientRepo();
    propertyRepo = makePropertyRepo();
    auditRepo = makeAuditRepo();
    useCase = new CreateStandaloneQuoteUseCase(quoteRepo, clientRepo, propertyRepo, auditRepo);
  });

  it('creates a draft quote without property and records audit event', async () => {
    const result = await useCase.execute(
      { tenantId: 'tenant-1', userId: 'user-1', clientId: 'client-1', title: 'Lawn Service Quote' },
      correlationId,
    );

    expect(result.quote).toBeDefined();
    expect(result.quote.status).toBe('draft');
    expect(result.quote.clientId).toBe('client-1');
    expect(result.quote.propertyId).toBeNull();
    expect(result.quote.requestId).toBeNull();
    expect(result.quote.title).toBe('Lawn Service Quote');
    expect(result.quote.lineItems).toEqual([]);
    expect(result.quote.subtotal).toBe(0);
    expect(result.quote.tax).toBe(0);
    expect(result.quote.total).toBe(0);
    expect(quoteRepo.create).toHaveBeenCalledOnce();
    expect(auditRepo.recorded).toHaveLength(1);
    expect(auditRepo.recorded[0].eventName).toBe('quote.created');
  });

  it('creates a draft quote with property', async () => {
    const result = await useCase.execute(
      { tenantId: 'tenant-1', userId: 'user-1', clientId: 'client-1', propertyId: 'prop-1', title: 'Quote with Property' },
      correlationId,
    );

    expect(result.quote.propertyId).toBe('prop-1');
    expect(result.quote.clientId).toBe('client-1');
    expect(propertyRepo.getById).toHaveBeenCalledWith('tenant-1', 'prop-1');
  });

  it('trims title whitespace', async () => {
    const result = await useCase.execute(
      { tenantId: 'tenant-1', userId: 'user-1', clientId: 'client-1', title: '  Trimmed Title  ' },
      correlationId,
    );

    expect(result.quote.title).toBe('Trimmed Title');
  });

  it('throws ValidationError for empty title', async () => {
    await expect(
      useCase.execute(
        { tenantId: 'tenant-1', userId: 'user-1', clientId: 'client-1', title: '   ' },
        correlationId,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('throws NotFoundError when client does not exist', async () => {
    clientRepo = makeClientRepo({
      getById: vi.fn(async () => null),
    });
    useCase = new CreateStandaloneQuoteUseCase(quoteRepo, clientRepo, propertyRepo, auditRepo);

    await expect(
      useCase.execute(
        { tenantId: 'tenant-1', userId: 'user-1', clientId: 'missing-client', title: 'Quote' },
        correlationId,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ValidationError when client is inactive', async () => {
    clientRepo = makeClientRepo({
      getById: vi.fn(async () => makeClient({ active: false })),
    });
    useCase = new CreateStandaloneQuoteUseCase(quoteRepo, clientRepo, propertyRepo, auditRepo);

    await expect(
      useCase.execute(
        { tenantId: 'tenant-1', userId: 'user-1', clientId: 'client-1', title: 'Quote' },
        correlationId,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('throws NotFoundError when property does not exist', async () => {
    propertyRepo = makePropertyRepo({
      getById: vi.fn(async () => null),
    });
    useCase = new CreateStandaloneQuoteUseCase(quoteRepo, clientRepo, propertyRepo, auditRepo);

    await expect(
      useCase.execute(
        { tenantId: 'tenant-1', userId: 'user-1', clientId: 'client-1', propertyId: 'missing-prop', title: 'Quote' },
        correlationId,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ValidationError when property is inactive', async () => {
    propertyRepo = makePropertyRepo({
      getById: vi.fn(async () => makeProperty({ active: false })),
    });
    useCase = new CreateStandaloneQuoteUseCase(quoteRepo, clientRepo, propertyRepo, auditRepo);

    await expect(
      useCase.execute(
        { tenantId: 'tenant-1', userId: 'user-1', clientId: 'client-1', propertyId: 'prop-1', title: 'Quote' },
        correlationId,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError when property does not belong to client', async () => {
    propertyRepo = makePropertyRepo({
      getById: vi.fn(async () => makeProperty({ clientId: 'other-client' })),
    });
    useCase = new CreateStandaloneQuoteUseCase(quoteRepo, clientRepo, propertyRepo, auditRepo);

    await expect(
      useCase.execute(
        { tenantId: 'tenant-1', userId: 'user-1', clientId: 'client-1', propertyId: 'prop-1', title: 'Quote' },
        correlationId,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('records correct audit event fields', async () => {
    await useCase.execute(
      { tenantId: 'tenant-1', userId: 'user-1', clientId: 'client-1', title: 'Audit Check' },
      correlationId,
    );

    expect(auditRepo.recorded[0].tenantId).toBe('tenant-1');
    expect(auditRepo.recorded[0].principalType).toBe('internal');
    expect(auditRepo.recorded[0].principalId).toBe('user-1');
    expect(auditRepo.recorded[0].subjectType).toBe('quote');
    expect(auditRepo.recorded[0].correlationId).toBe('corr-test');
  });

  it('does not call propertyRepo.getById when propertyId is not provided', async () => {
    await useCase.execute(
      { tenantId: 'tenant-1', userId: 'user-1', clientId: 'client-1', title: 'No Property' },
      correlationId,
    );

    expect(propertyRepo.getById).not.toHaveBeenCalled();
  });

  it('still returns quote when audit recording fails (best-effort)', async () => {
    auditRepo.record = vi.fn(async () => { throw new Error('DB connection lost'); });
    useCase = new CreateStandaloneQuoteUseCase(quoteRepo, clientRepo, propertyRepo, auditRepo);

    const result = await useCase.execute(
      { tenantId: 'tenant-1', userId: 'user-1', clientId: 'client-1', title: 'Resilient Quote' },
      correlationId,
    );

    expect(result.quote).toBeDefined();
    expect(result.quote.title).toBe('Resilient Quote');
    expect(quoteRepo.create).toHaveBeenCalledOnce();
  });
});
