import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateServiceCategoryUseCase } from '../../src/application/usecases/create-service-category.js';
import { UpdateServiceCategoryUseCase } from '../../src/application/usecases/update-service-category.js';
import { DeactivateServiceCategoryUseCase } from '../../src/application/usecases/deactivate-service-category.js';
import type { ServiceCategoryRepository } from '../../src/application/ports/service-category-repository.js';
import type {
  AuditEventRepository,
  AuditEvent,
} from '../../src/application/ports/audit-event-repository.js';
import { ValidationError } from '../../src/shared/errors.js';
import { NotFoundError } from '../../src/shared/errors.js';

function makeCategoryRepo(
  overrides: Partial<ServiceCategoryRepository> = {},
): ServiceCategoryRepository {
  return {
    list: vi.fn(async () => []),
    getById: vi.fn(async () => null),
    create: vi.fn(async (c) => ({ ...c, createdAt: new Date(), updatedAt: new Date() })),
    update: vi.fn(async (tenantId, id, patch) => ({
      id,
      tenantId,
      name: 'Updated',
      description: null,
      sortOrder: 0,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...patch,
    })),
    deactivate: vi.fn(async () => true),
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

const correlationId = 'corr-test';

describe('CreateServiceCategoryUseCase', () => {
  let categoryRepo: ServiceCategoryRepository;
  let auditRepo: ReturnType<typeof makeAuditRepo>;
  let useCase: CreateServiceCategoryUseCase;

  beforeEach(() => {
    categoryRepo = makeCategoryRepo();
    auditRepo = makeAuditRepo();
    useCase = new CreateServiceCategoryUseCase(categoryRepo, auditRepo);
  });

  it('creates category and records audit event', async () => {
    const result = await useCase.execute(
      { tenantId: 'tenant-1', userId: 'user-1', name: 'Lawn Care', description: 'Mowing etc', sortOrder: 0 },
      correlationId,
    );

    expect(result.category.name).toBe('Lawn Care');
    expect(result.category.tenantId).toBe('tenant-1');
    expect(categoryRepo.create).toHaveBeenCalledOnce();
    expect(auditRepo.recorded).toHaveLength(1);
    expect(auditRepo.recorded[0].eventName).toBe('service_category.created');
    expect(auditRepo.recorded[0].subjectType).toBe('service_category');
  });

  it('throws ValidationError for empty name', async () => {
    await expect(
      useCase.execute(
        { tenantId: 'tenant-1', userId: 'user-1', name: '   ', description: null },
        correlationId,
      ),
    ).rejects.toThrow(ValidationError);
  });
});

describe('UpdateServiceCategoryUseCase', () => {
  let categoryRepo: ServiceCategoryRepository;
  let auditRepo: ReturnType<typeof makeAuditRepo>;
  let useCase: UpdateServiceCategoryUseCase;

  beforeEach(() => {
    categoryRepo = makeCategoryRepo();
    auditRepo = makeAuditRepo();
    useCase = new UpdateServiceCategoryUseCase(categoryRepo, auditRepo);
  });

  it('updates category and records audit event', async () => {
    const result = await useCase.execute(
      { tenantId: 'tenant-1', userId: 'user-1', id: 'cat-1', name: 'Updated Name' },
      correlationId,
    );

    expect(result.category).toBeDefined();
    expect(categoryRepo.update).toHaveBeenCalledOnce();
    expect(auditRepo.recorded).toHaveLength(1);
    expect(auditRepo.recorded[0].eventName).toBe('service_category.updated');
  });

  it('throws NotFoundError when category does not exist', async () => {
    categoryRepo = makeCategoryRepo({
      update: vi.fn(async () => null),
    });
    useCase = new UpdateServiceCategoryUseCase(categoryRepo, auditRepo);

    await expect(
      useCase.execute(
        { tenantId: 'tenant-1', userId: 'user-1', id: 'missing', name: 'No' },
        correlationId,
      ),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('DeactivateServiceCategoryUseCase', () => {
  let categoryRepo: ServiceCategoryRepository;
  let auditRepo: ReturnType<typeof makeAuditRepo>;
  let useCase: DeactivateServiceCategoryUseCase;

  beforeEach(() => {
    categoryRepo = makeCategoryRepo();
    auditRepo = makeAuditRepo();
    useCase = new DeactivateServiceCategoryUseCase(categoryRepo, auditRepo);
  });

  it('deactivates category and records audit event', async () => {
    await useCase.execute(
      { tenantId: 'tenant-1', userId: 'user-1', id: 'cat-1' },
      correlationId,
    );

    expect(categoryRepo.deactivate).toHaveBeenCalledWith('tenant-1', 'cat-1');
    expect(auditRepo.recorded).toHaveLength(1);
    expect(auditRepo.recorded[0].eventName).toBe('service_category.deactivated');
  });

  it('throws NotFoundError when category does not exist', async () => {
    categoryRepo = makeCategoryRepo({
      deactivate: vi.fn(async () => false),
    });
    useCase = new DeactivateServiceCategoryUseCase(categoryRepo, auditRepo);

    await expect(
      useCase.execute(
        { tenantId: 'tenant-1', userId: 'user-1', id: 'missing' },
        correlationId,
      ),
    ).rejects.toThrow(NotFoundError);
  });
});
