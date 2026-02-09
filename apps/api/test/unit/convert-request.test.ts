import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConvertRequestUseCase } from '../../src/application/usecases/convert-request.js';
import type { RequestRepository } from '../../src/application/ports/request-repository.js';
import type { ClientRepository } from '../../src/application/ports/client-repository.js';
import type { PropertyRepository } from '../../src/application/ports/property-repository.js';
import type { QuoteRepository } from '../../src/application/ports/quote-repository.js';
import type {
  AuditEventRepository,
  AuditEvent,
} from '../../src/application/ports/audit-event-repository.js';
import type { UnitOfWork } from '../../src/application/ports/unit-of-work.js';
import type { ConvertRequestInput } from '../../src/application/dto/convert-request-dto.js';
import { NotFoundError, ValidationError, ConflictError } from '../../src/shared/errors.js';

function makeRequestRepo(overrides: Partial<RequestRepository> = {}): RequestRepository {
  return {
    list: vi.fn(async () => ({ data: [], cursor: null, hasMore: false })),
    getById: vi.fn(async (_tid, _id) => ({
      id: 'req-1',
      tenantId: 'tenant-1',
      source: 'public_form' as const,
      clientName: 'Sarah Jane Davis',
      clientEmail: 'sarah@example.com',
      clientPhone: '555-1234',
      description: 'Need lawn mowing',
      status: 'new' as const,
      assignedUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    create: vi.fn(async (r) => ({ ...r, createdAt: new Date(), updatedAt: new Date() })),
    updateStatus: vi.fn(async (_tid, _id, status) => ({
      id: 'req-1',
      tenantId: 'tenant-1',
      source: 'public_form' as const,
      clientName: 'Sarah Jane Davis',
      clientEmail: 'sarah@example.com',
      clientPhone: '555-1234',
      description: 'Need lawn mowing',
      status: status as any,
      assignedUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    count: vi.fn(async () => 0),
    countByStatus: vi.fn(async () => 0),
    ...overrides,
  };
}

function makeClientRepo(overrides: Partial<ClientRepository> = {}): ClientRepository {
  return {
    list: vi.fn(async () => ({ data: [], cursor: null, hasMore: false })),
    getById: vi.fn(async () => null),
    create: vi.fn(async (c) => ({ ...c, createdAt: new Date(), updatedAt: new Date() })),
    update: vi.fn(async () => null),
    deactivate: vi.fn(async () => true),
    count: vi.fn(async () => 0),
    ...overrides,
  };
}

function makePropertyRepo(overrides: Partial<PropertyRepository> = {}): PropertyRepository {
  return {
    listByClientId: vi.fn(async () => []),
    getById: vi.fn(async () => null),
    create: vi.fn(async (p) => ({ ...p, createdAt: new Date(), updatedAt: new Date() })),
    update: vi.fn(async () => null),
    deactivate: vi.fn(async () => true),
    deactivateByClientId: vi.fn(async () => 0),
    ...overrides,
  };
}

function makeQuoteRepo(overrides: Partial<QuoteRepository> = {}): QuoteRepository {
  return {
    create: vi.fn(async (q) => ({ ...q, createdAt: new Date(), updatedAt: new Date() })),
    getById: vi.fn(async () => null),
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

function makeUnitOfWork(
  clientRepo: ClientRepository,
  propertyRepo: PropertyRepository,
  requestRepo: RequestRepository,
  quoteRepo: QuoteRepository,
  auditRepo: AuditEventRepository,
): UnitOfWork {
  return {
    run: async (fn) => fn({
      tenantRepo: {} as any,
      userRepo: {} as any,
      auditRepo,
      clientRepo,
      propertyRepo,
      requestRepo,
      quoteRepo,
    }),
  };
}

const correlationId = 'corr-test-123';

function makeInput(overrides: Partial<ConvertRequestInput> = {}): ConvertRequestInput {
  return {
    tenantId: 'tenant-1',
    userId: 'user-1',
    requestId: 'req-1',
    firstName: 'Sarah Jane',
    lastName: 'Davis',
    email: 'sarah@example.com',
    phone: '555-1234',
    addressLine1: '123 Main St',
    city: 'Springfield',
    state: 'IL',
    zip: '62701',
    quoteTitle: 'Service for Sarah Jane Davis',
    ...overrides,
  };
}

describe('ConvertRequestUseCase', () => {
  let requestRepo: RequestRepository;
  let clientRepo: ClientRepository;
  let propertyRepo: PropertyRepository;
  let quoteRepo: QuoteRepository;
  let auditRepo: ReturnType<typeof makeAuditRepo>;
  let uow: UnitOfWork;
  let useCase: ConvertRequestUseCase;

  beforeEach(() => {
    requestRepo = makeRequestRepo();
    clientRepo = makeClientRepo();
    propertyRepo = makePropertyRepo();
    quoteRepo = makeQuoteRepo();
    auditRepo = makeAuditRepo();
    uow = makeUnitOfWork(clientRepo, propertyRepo, requestRepo, quoteRepo, auditRepo);
    useCase = new ConvertRequestUseCase(requestRepo, clientRepo, uow);
  });

  it('creates new client, property, and quote draft on happy path', async () => {
    const result = await useCase.execute(makeInput(), correlationId);

    expect(result.clientCreated).toBe(true);
    expect(result.client.firstName).toBe('Sarah Jane');
    expect(result.client.lastName).toBe('Davis');
    expect(result.client.email).toBe('sarah@example.com');
    expect(result.property.addressLine1).toBe('123 Main St');
    expect(result.quote.title).toBe('Service for Sarah Jane Davis');
    expect(result.quote.status).toBe('draft');
    expect(result.quote.lineItems).toEqual([]);
    expect(result.quote.subtotal).toBe(0);
    expect(result.quote.tax).toBe(0);
    expect(result.quote.total).toBe(0);
    expect(result.request.status).toBe('converted');
  });

  it('uses existing client when existingClientId is provided', async () => {
    const existingClient = {
      id: 'existing-client-1',
      tenantId: 'tenant-1',
      firstName: 'Sarah',
      lastName: 'Davis',
      email: 'sarah@example.com',
      phone: '555-1234',
      company: null,
      notes: null,
      tags: [],
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    clientRepo = makeClientRepo({
      getById: vi.fn(async () => existingClient),
    });
    uow = makeUnitOfWork(clientRepo, propertyRepo, requestRepo, quoteRepo, auditRepo);
    useCase = new ConvertRequestUseCase(requestRepo, clientRepo, uow);

    const result = await useCase.execute(
      makeInput({ existingClientId: 'existing-client-1' }),
      correlationId,
    );

    expect(result.clientCreated).toBe(false);
    expect(result.client.id).toBe('existing-client-1');
    // Should NOT have called clientRepo.create in UoW
    expect(auditRepo.recorded.find((e) => e.eventName === 'client.created')).toBeUndefined();
  });

  it('throws ValidationError for request with status "converted"', async () => {
    requestRepo = makeRequestRepo({
      getById: vi.fn(async () => ({
        id: 'req-1',
        tenantId: 'tenant-1',
        source: 'public_form' as const,
        clientName: 'Already Done',
        clientEmail: 'done@example.com',
        clientPhone: null,
        description: 'Already converted',
        status: 'converted' as const,
        assignedUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    });
    useCase = new ConvertRequestUseCase(requestRepo, clientRepo, uow);

    await expect(
      useCase.execute(makeInput(), correlationId),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for request with status "declined"', async () => {
    requestRepo = makeRequestRepo({
      getById: vi.fn(async () => ({
        id: 'req-1',
        tenantId: 'tenant-1',
        source: 'public_form' as const,
        clientName: 'Declined',
        clientEmail: 'declined@example.com',
        clientPhone: null,
        description: 'Declined request',
        status: 'declined' as const,
        assignedUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    });
    useCase = new ConvertRequestUseCase(requestRepo, clientRepo, uow);

    await expect(
      useCase.execute(makeInput(), correlationId),
    ).rejects.toThrow(ValidationError);
  });

  it('allows conversion from "reviewed" status', async () => {
    requestRepo = makeRequestRepo({
      getById: vi.fn(async () => ({
        id: 'req-1',
        tenantId: 'tenant-1',
        source: 'public_form' as const,
        clientName: 'Reviewed Client',
        clientEmail: 'reviewed@example.com',
        clientPhone: null,
        description: 'Reviewed request',
        status: 'reviewed' as const,
        assignedUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    });
    uow = makeUnitOfWork(clientRepo, propertyRepo, requestRepo, quoteRepo, auditRepo);
    useCase = new ConvertRequestUseCase(requestRepo, clientRepo, uow);

    const result = await useCase.execute(makeInput(), correlationId);
    expect(result.request.status).toBe('converted');
  });

  it('throws NotFoundError for non-existent request', async () => {
    requestRepo = makeRequestRepo({
      getById: vi.fn(async () => null),
    });
    useCase = new ConvertRequestUseCase(requestRepo, clientRepo, uow);

    await expect(
      useCase.execute(makeInput(), correlationId),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError for non-existent existingClientId', async () => {
    clientRepo = makeClientRepo({
      getById: vi.fn(async () => null),
    });
    uow = makeUnitOfWork(clientRepo, propertyRepo, requestRepo, quoteRepo, auditRepo);
    useCase = new ConvertRequestUseCase(requestRepo, clientRepo, uow);

    await expect(
      useCase.execute(makeInput({ existingClientId: 'nonexistent' }), correlationId),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ValidationError for empty firstName', async () => {
    await expect(
      useCase.execute(makeInput({ firstName: '  ' }), correlationId),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for empty addressLine1', async () => {
    await expect(
      useCase.execute(makeInput({ addressLine1: '  ' }), correlationId),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for empty quoteTitle', async () => {
    await expect(
      useCase.execute(makeInput({ quoteTitle: '' }), correlationId),
    ).rejects.toThrow(ValidationError);
  });

  it('records 4 audit events for new client scenario', async () => {
    await useCase.execute(makeInput(), correlationId);

    expect(auditRepo.recorded).toHaveLength(4);
    const eventNames = auditRepo.recorded.map((e) => e.eventName);
    expect(eventNames).toContain('request.converted');
    expect(eventNames).toContain('client.created');
    expect(eventNames).toContain('property.created');
    expect(eventNames).toContain('quote.created');
  });

  it('records 3 audit events for existing client scenario (no client.created)', async () => {
    const existingClient = {
      id: 'existing-client-1',
      tenantId: 'tenant-1',
      firstName: 'Sarah',
      lastName: 'Davis',
      email: 'sarah@example.com',
      phone: '555-1234',
      company: null,
      notes: null,
      tags: [],
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    clientRepo = makeClientRepo({
      getById: vi.fn(async () => existingClient),
    });
    uow = makeUnitOfWork(clientRepo, propertyRepo, requestRepo, quoteRepo, auditRepo);
    useCase = new ConvertRequestUseCase(requestRepo, clientRepo, uow);

    await useCase.execute(
      makeInput({ existingClientId: 'existing-client-1' }),
      correlationId,
    );

    expect(auditRepo.recorded).toHaveLength(3);
    const eventNames = auditRepo.recorded.map((e) => e.eventName);
    expect(eventNames).toContain('request.converted');
    expect(eventNames).not.toContain('client.created');
    expect(eventNames).toContain('property.created');
    expect(eventNames).toContain('quote.created');
  });

  it('maps unique constraint violation to ConflictError', async () => {
    const dbError = Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
    });
    clientRepo = makeClientRepo({
      create: vi.fn(async () => { throw dbError; }),
    });
    uow = makeUnitOfWork(clientRepo, propertyRepo, requestRepo, quoteRepo, auditRepo);
    useCase = new ConvertRequestUseCase(requestRepo, clientRepo, uow);

    await expect(
      useCase.execute(makeInput(), correlationId),
    ).rejects.toThrow(ConflictError);
  });
});
