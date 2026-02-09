import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreatePublicRequestUseCase } from '../../src/application/usecases/create-public-request.js';
import type { TenantRepository } from '../../src/application/ports/tenant-repository.js';
import type { RequestRepository } from '../../src/application/ports/request-repository.js';
import type {
  AuditEventRepository,
  AuditEvent,
} from '../../src/application/ports/audit-event-repository.js';
import { ValidationError, NotFoundError } from '../../src/shared/errors.js';

const DEMO_TENANT = {
  id: 'tenant-1',
  slug: 'demo',
  name: 'Demo Business',
  status: 'active' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeTenantRepo(overrides: Partial<TenantRepository> = {}): TenantRepository {
  return {
    create: vi.fn(async () => DEMO_TENANT),
    getById: vi.fn(async () => DEMO_TENANT),
    getBySlug: vi.fn(async () => DEMO_TENANT),
    ...overrides,
  };
}

function makeRequestRepo(overrides: Partial<RequestRepository> = {}): RequestRepository {
  return {
    list: vi.fn(async () => ({ data: [], cursor: null, hasMore: false })),
    getById: vi.fn(async () => null),
    create: vi.fn(async (r) => ({ ...r, createdAt: new Date(), updatedAt: new Date() })),
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

describe('CreatePublicRequestUseCase', () => {
  let tenantRepo: TenantRepository;
  let requestRepo: RequestRepository;
  let auditRepo: ReturnType<typeof makeAuditRepo>;
  let useCase: CreatePublicRequestUseCase;

  beforeEach(() => {
    tenantRepo = makeTenantRepo();
    requestRepo = makeRequestRepo();
    auditRepo = makeAuditRepo();
    useCase = new CreatePublicRequestUseCase(tenantRepo, requestRepo, auditRepo);
  });

  it('creates request with status new and source public_form', async () => {
    const result = await useCase.execute(
      {
        tenantSlug: 'demo',
        clientName: 'John Smith',
        clientEmail: 'john@example.com',
        clientPhone: '555-1234',
        description: 'I need lawn service',
        honeypot: null,
      },
      correlationId,
    );

    expect(result.request.clientName).toBe('John Smith');
    expect(result.request.clientEmail).toBe('john@example.com');
    expect(result.request.status).toBe('new');
    expect(result.request.source).toBe('public_form');
    expect(result.request.tenantId).toBe('tenant-1');
    expect(requestRepo.create).toHaveBeenCalledOnce();
  });

  it('records audit event with system principal', async () => {
    await useCase.execute(
      {
        tenantSlug: 'demo',
        clientName: 'John Smith',
        clientEmail: 'john@example.com',
        clientPhone: null,
        description: 'I need lawn service',
        honeypot: null,
      },
      correlationId,
    );

    expect(auditRepo.recorded).toHaveLength(1);
    expect(auditRepo.recorded[0].eventName).toBe('request.created');
    expect(auditRepo.recorded[0].subjectType).toBe('request');
    expect(auditRepo.recorded[0].principalType).toBe('system');
    expect(auditRepo.recorded[0].principalId).toBe('public_form');
  });

  it('throws ValidationError for empty clientName', async () => {
    await expect(
      useCase.execute(
        {
          tenantSlug: 'demo',
          clientName: '   ',
          clientEmail: 'john@example.com',
          clientPhone: null,
          description: 'I need lawn service',
          honeypot: null,
        },
        correlationId,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for empty clientEmail', async () => {
    await expect(
      useCase.execute(
        {
          tenantSlug: 'demo',
          clientName: 'John Smith',
          clientEmail: '   ',
          clientPhone: null,
          description: 'I need lawn service',
          honeypot: null,
        },
        correlationId,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for invalid email format', async () => {
    await expect(
      useCase.execute(
        {
          tenantSlug: 'demo',
          clientName: 'John Smith',
          clientEmail: 'not-an-email',
          clientPhone: null,
          description: 'I need lawn service',
          honeypot: null,
        },
        correlationId,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for empty description', async () => {
    await expect(
      useCase.execute(
        {
          tenantSlug: 'demo',
          clientName: 'John Smith',
          clientEmail: 'john@example.com',
          clientPhone: null,
          description: '  ',
          honeypot: null,
        },
        correlationId,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('throws NotFoundError for nonexistent tenant slug', async () => {
    tenantRepo = makeTenantRepo({
      getBySlug: vi.fn(async () => null),
    });
    useCase = new CreatePublicRequestUseCase(tenantRepo, requestRepo, auditRepo);

    await expect(
      useCase.execute(
        {
          tenantSlug: 'nonexistent',
          clientName: 'John Smith',
          clientEmail: 'john@example.com',
          clientPhone: null,
          description: 'I need lawn service',
          honeypot: null,
        },
        correlationId,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it('returns fake success without persisting when honeypot is filled', async () => {
    const result = await useCase.execute(
      {
        tenantSlug: 'demo',
        clientName: 'Bot User',
        clientEmail: 'bot@spam.com',
        clientPhone: null,
        description: 'Buy cheap stuff',
        honeypot: 'http://spam.com',
      },
      correlationId,
    );

    // Should return a result with fake data
    expect(result.request.id).toBeDefined();
    expect(result.request.status).toBe('new');
    // But should NOT have called create or audit
    expect(requestRepo.create).not.toHaveBeenCalled();
    expect(auditRepo.recorded).toHaveLength(0);
  });

  it('trims whitespace from input fields', async () => {
    const result = await useCase.execute(
      {
        tenantSlug: 'demo',
        clientName: '  John Smith  ',
        clientEmail: '  john@example.com  ',
        clientPhone: '  555-1234  ',
        description: '  I need lawn service  ',
        honeypot: null,
      },
      correlationId,
    );

    expect(result.request.clientName).toBe('John Smith');
    expect(result.request.clientEmail).toBe('john@example.com');
    expect(result.request.clientPhone).toBe('555-1234');
    expect(result.request.description).toBe('I need lawn service');
  });
});
