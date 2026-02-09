import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateServiceItemUseCase } from '../../src/application/usecases/create-service-item.js';
import { UpdateServiceItemUseCase } from '../../src/application/usecases/update-service-item.js';
import { DeactivateServiceItemUseCase } from '../../src/application/usecases/deactivate-service-item.js';
import type { ServiceItemRepository } from '../../src/application/ports/service-item-repository.js';
import type { ServiceCategoryRepository } from '../../src/application/ports/service-category-repository.js';
import type {
  AuditEventRepository,
  AuditEvent,
} from '../../src/application/ports/audit-event-repository.js';
import { ValidationError, NotFoundError } from '../../src/shared/errors.js';

function makeItemRepo(overrides: Partial<ServiceItemRepository> = {}): ServiceItemRepository {
  return {
    list: vi.fn(async () => []),
    getById: vi.fn(async () => null),
    create: vi.fn(async (item) => ({ ...item, createdAt: new Date(), updatedAt: new Date() })),
    update: vi.fn(async (tenantId, id, patch) => ({
      id,
      tenantId,
      categoryId: 'cat-1',
      name: 'Updated',
      description: null,
      unitPrice: 5000,
      unitType: 'flat' as const,
      estimatedDurationMinutes: null,
      active: true,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...patch,
    })),
    deactivate: vi.fn(async () => true),
    deactivateByCategoryId: vi.fn(async () => 0),
    countByCategoryId: vi.fn(async () => 0),
    ...overrides,
  };
}

function makeCategoryRepo(
  overrides: Partial<ServiceCategoryRepository> = {},
): ServiceCategoryRepository {
  return {
    list: vi.fn(async () => []),
    getById: vi.fn(async () => ({
      id: 'cat-1',
      tenantId: 'tenant-1',
      name: 'Lawn Care',
      description: null,
      sortOrder: 0,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    create: vi.fn(async (c) => ({ ...c, createdAt: new Date(), updatedAt: new Date() })),
    update: vi.fn(async () => null),
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
    listBySubjects: vi.fn(async () => ({ data: [], cursor: null, hasMore: false })),
  };
}

const correlationId = 'corr-test';

describe('CreateServiceItemUseCase', () => {
  let itemRepo: ServiceItemRepository;
  let categoryRepo: ServiceCategoryRepository;
  let auditRepo: ReturnType<typeof makeAuditRepo>;
  let useCase: CreateServiceItemUseCase;

  beforeEach(() => {
    itemRepo = makeItemRepo();
    categoryRepo = makeCategoryRepo();
    auditRepo = makeAuditRepo();
    useCase = new CreateServiceItemUseCase(itemRepo, categoryRepo, auditRepo);
  });

  it('creates service item and records audit event', async () => {
    const result = await useCase.execute(
      {
        tenantId: 'tenant-1',
        userId: 'user-1',
        categoryId: 'cat-1',
        name: 'Weekly Mowing',
        description: null,
        unitPrice: 4500,
        unitType: 'per_visit',
        estimatedDurationMinutes: 45,
      },
      correlationId,
    );

    expect(result.item.name).toBe('Weekly Mowing');
    expect(result.item.unitPrice).toBe(4500);
    expect(itemRepo.create).toHaveBeenCalledOnce();
    expect(auditRepo.recorded).toHaveLength(1);
    expect(auditRepo.recorded[0].eventName).toBe('service_item.created');
    expect(auditRepo.recorded[0].subjectType).toBe('service_item');
  });

  it('throws NotFoundError when category does not exist', async () => {
    categoryRepo = makeCategoryRepo({ getById: vi.fn(async () => null) });
    useCase = new CreateServiceItemUseCase(itemRepo, categoryRepo, auditRepo);

    await expect(
      useCase.execute(
        {
          tenantId: 'tenant-1',
          userId: 'user-1',
          categoryId: 'missing',
          name: 'Mowing',
          description: null,
          unitPrice: 4500,
          unitType: 'flat',
          estimatedDurationMinutes: null,
        },
        correlationId,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ValidationError for negative unitPrice', async () => {
    await expect(
      useCase.execute(
        {
          tenantId: 'tenant-1',
          userId: 'user-1',
          categoryId: 'cat-1',
          name: 'Mowing',
          description: null,
          unitPrice: -100,
          unitType: 'flat',
          estimatedDurationMinutes: null,
        },
        correlationId,
      ),
    ).rejects.toThrow(ValidationError);
  });
});

describe('UpdateServiceItemUseCase', () => {
  let itemRepo: ServiceItemRepository;
  let auditRepo: ReturnType<typeof makeAuditRepo>;
  let useCase: UpdateServiceItemUseCase;

  beforeEach(() => {
    itemRepo = makeItemRepo();
    auditRepo = makeAuditRepo();
    useCase = new UpdateServiceItemUseCase(itemRepo, auditRepo);
  });

  it('updates service item and records audit event', async () => {
    const result = await useCase.execute(
      { tenantId: 'tenant-1', userId: 'user-1', id: 'svc-1', unitPrice: 5500 },
      correlationId,
    );

    expect(result.item).toBeDefined();
    expect(itemRepo.update).toHaveBeenCalledOnce();
    expect(auditRepo.recorded).toHaveLength(1);
    expect(auditRepo.recorded[0].eventName).toBe('service_item.updated');
  });

  it('throws NotFoundError when item does not exist', async () => {
    itemRepo = makeItemRepo({ update: vi.fn(async () => null) });
    useCase = new UpdateServiceItemUseCase(itemRepo, auditRepo);

    await expect(
      useCase.execute(
        { tenantId: 'tenant-1', userId: 'user-1', id: 'missing', name: 'No' },
        correlationId,
      ),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('DeactivateServiceItemUseCase', () => {
  let itemRepo: ServiceItemRepository;
  let auditRepo: ReturnType<typeof makeAuditRepo>;
  let useCase: DeactivateServiceItemUseCase;

  beforeEach(() => {
    itemRepo = makeItemRepo();
    auditRepo = makeAuditRepo();
    useCase = new DeactivateServiceItemUseCase(itemRepo, auditRepo);
  });

  it('deactivates item and records audit event', async () => {
    await useCase.execute(
      { tenantId: 'tenant-1', userId: 'user-1', id: 'svc-1' },
      correlationId,
    );

    expect(itemRepo.deactivate).toHaveBeenCalledWith('tenant-1', 'svc-1');
    expect(auditRepo.recorded).toHaveLength(1);
    expect(auditRepo.recorded[0].eventName).toBe('service_item.deactivated');
  });

  it('throws NotFoundError when item does not exist', async () => {
    itemRepo = makeItemRepo({ deactivate: vi.fn(async () => false) });
    useCase = new DeactivateServiceItemUseCase(itemRepo, auditRepo);

    await expect(
      useCase.execute(
        { tenantId: 'tenant-1', userId: 'user-1', id: 'missing' },
        correlationId,
      ),
    ).rejects.toThrow(NotFoundError);
  });
});
