import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateTenantUseCase, slugify } from '../../src/application/usecases/create-tenant.js';
import type { TenantRepository } from '../../src/application/ports/tenant-repository.js';
import type { UserRepository } from '../../src/application/ports/user-repository.js';
import type {
  AuditEventRepository,
  AuditEvent,
} from '../../src/application/ports/audit-event-repository.js';
import type { UnitOfWork } from '../../src/application/ports/unit-of-work.js';
import { ConflictError, ValidationError } from '../../src/shared/errors.js';

function makeTenantRepo(overrides: Partial<TenantRepository> = {}): TenantRepository {
  return {
    create: vi.fn(async (t) => ({ ...t, createdAt: new Date(), updatedAt: new Date() })),
    getById: vi.fn(async () => null),
    getBySlug: vi.fn(async () => null),
    ...overrides,
  };
}

function makeUserRepo(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    create: vi.fn(async (u) => ({ ...u, createdAt: new Date(), updatedAt: new Date() })),
    getById: vi.fn(async () => null),
    getByEmail: vi.fn(async () => null),
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
  };
}

function makeUnitOfWork(
  tenantRepo: TenantRepository,
  userRepo: UserRepository,
  auditRepo: AuditEventRepository,
): UnitOfWork {
  return {
    run: async (fn) => fn({ tenantRepo, userRepo, auditRepo }),
  };
}

describe('slugify', () => {
  it('converts a simple name to a slug', () => {
    expect(slugify('My Business')).toBe('my-business');
  });

  it('handles special characters', () => {
    expect(slugify("Bob's Plumbing & HVAC")).toBe('bob-s-plumbing-hvac');
  });

  it('trims leading/trailing hyphens', () => {
    expect(slugify('  --Hello World--  ')).toBe('hello-world');
  });

  it('collapses multiple separators', () => {
    expect(slugify('Foo   Bar   Baz')).toBe('foo-bar-baz');
  });

  it('handles numbers', () => {
    expect(slugify('123 Business')).toBe('123-business');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(slugify('   ')).toBe('');
  });

  it('returns empty string for symbol-only input', () => {
    expect(slugify('!!!')).toBe('');
  });
});

describe('CreateTenantUseCase', () => {
  let tenantRepo: TenantRepository;
  let userRepo: UserRepository;
  let auditRepo: ReturnType<typeof makeAuditRepo>;
  let uow: UnitOfWork;
  let useCase: CreateTenantUseCase;

  const validInput = {
    businessName: 'Acme Landscaping',
    ownerEmail: 'owner@acme.test',
    ownerFullName: 'Jane Doe',
  };

  const correlationId = 'corr-123';

  beforeEach(() => {
    tenantRepo = makeTenantRepo();
    userRepo = makeUserRepo();
    auditRepo = makeAuditRepo();
    uow = makeUnitOfWork(tenantRepo, userRepo, auditRepo);
    useCase = new CreateTenantUseCase(tenantRepo, uow);
  });

  it('creates tenant and owner user on happy path', async () => {
    const result = await useCase.execute(validInput, correlationId);

    expect(result.tenant.name).toBe('Acme Landscaping');
    expect(result.tenant.slug).toBe('acme-landscaping');
    expect(result.tenant.status).toBe('active');

    expect(result.user.email).toBe('owner@acme.test');
    expect(result.user.fullName).toBe('Jane Doe');
    expect(result.user.role).toBe('owner');
    expect(result.user.status).toBe('active');
    expect(result.user.tenantId).toBe(result.tenant.id);
  });

  it('throws ValidationError when business name produces empty slug', async () => {
    await expect(
      useCase.execute({ ...validInput, businessName: '!!!' }, correlationId),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for whitespace-only business name', async () => {
    await expect(
      useCase.execute({ ...validInput, businessName: '   ' }, correlationId),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ConflictError when slug already exists', async () => {
    tenantRepo = makeTenantRepo({
      getBySlug: vi.fn(async () => ({
        id: 'existing',
        slug: 'acme-landscaping',
        name: 'Acme Landscaping',
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    });
    useCase = new CreateTenantUseCase(tenantRepo, uow);

    await expect(useCase.execute(validInput, correlationId)).rejects.toThrow(ConflictError);
  });

  it('records tenant.created and auth.signup audit events', async () => {
    const result = await useCase.execute(validInput, correlationId);

    expect(auditRepo.recorded).toHaveLength(2);

    const tenantCreated = auditRepo.recorded.find((e) => e.eventName === 'tenant.created');
    expect(tenantCreated).toBeDefined();
    expect(tenantCreated!.tenantId).toBe(result.tenant.id);
    expect(tenantCreated!.subjectType).toBe('tenant');
    expect(tenantCreated!.subjectId).toBe(result.tenant.id);
    expect(tenantCreated!.correlationId).toBe(correlationId);

    const authSignup = auditRepo.recorded.find((e) => e.eventName === 'auth.signup');
    expect(authSignup).toBeDefined();
    expect(authSignup!.tenantId).toBe(result.tenant.id);
    expect(authSignup!.subjectType).toBe('user');
    expect(authSignup!.subjectId).toBe(result.user.id);
  });

  it('calls tenantRepo.create with correct fields', async () => {
    await useCase.execute(validInput, correlationId);

    expect(tenantRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'acme-landscaping',
        name: 'Acme Landscaping',
        status: 'active',
      }),
    );
  });

  it('maps DB unique-constraint violation on slug to ConflictError (race condition)', async () => {
    const dbError = Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
      constraint: 'tenants_slug_unique',
    });
    tenantRepo = makeTenantRepo({
      create: vi.fn(async () => { throw dbError; }),
    });
    uow = makeUnitOfWork(tenantRepo, userRepo, auditRepo);
    useCase = new CreateTenantUseCase(tenantRepo, uow);

    await expect(useCase.execute(validInput, correlationId)).rejects.toThrow(ConflictError);
  });

  it('re-throws non-unique-constraint errors from uow.run()', async () => {
    const randomError = new Error('connection lost');
    tenantRepo = makeTenantRepo({
      create: vi.fn(async () => { throw randomError; }),
    });
    uow = makeUnitOfWork(tenantRepo, userRepo, auditRepo);
    useCase = new CreateTenantUseCase(tenantRepo, uow);

    await expect(useCase.execute(validInput, correlationId)).rejects.toThrow('connection lost');
  });

  it('calls userRepo.create with correct fields', async () => {
    const result = await useCase.execute(validInput, correlationId);

    expect(userRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: result.tenant.id,
        email: 'owner@acme.test',
        fullName: 'Jane Doe',
        role: 'owner',
        status: 'active',
      }),
    );
  });
});
