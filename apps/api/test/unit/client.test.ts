import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateClientUseCase } from '../../src/application/usecases/create-client.js';
import { UpdateClientUseCase } from '../../src/application/usecases/update-client.js';
import { DeactivateClientUseCase } from '../../src/application/usecases/deactivate-client.js';
import type { ClientRepository } from '../../src/application/ports/client-repository.js';
import type { PropertyRepository } from '../../src/application/ports/property-repository.js';
import type {
  AuditEventRepository,
  AuditEvent,
} from '../../src/application/ports/audit-event-repository.js';
import { ValidationError, NotFoundError } from '../../src/shared/errors.js';

function makeClientRepo(overrides: Partial<ClientRepository> = {}): ClientRepository {
  return {
    list: vi.fn(async () => ({ data: [], cursor: null, hasMore: false })),
    getById: vi.fn(async () => null),
    create: vi.fn(async (c) => ({ ...c, createdAt: new Date(), updatedAt: new Date() })),
    update: vi.fn(async (tenantId, id, patch) => ({
      id,
      tenantId,
      firstName: 'Updated',
      lastName: 'Client',
      email: null,
      phone: null,
      company: null,
      notes: null,
      tags: [],
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...patch,
    })),
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

describe('CreateClientUseCase', () => {
  let clientRepo: ClientRepository;
  let auditRepo: ReturnType<typeof makeAuditRepo>;
  let useCase: CreateClientUseCase;

  beforeEach(() => {
    clientRepo = makeClientRepo();
    auditRepo = makeAuditRepo();
    useCase = new CreateClientUseCase(clientRepo, auditRepo);
  });

  it('creates client and records audit event', async () => {
    const result = await useCase.execute(
      {
        tenantId: 'tenant-1',
        userId: 'user-1',
        firstName: 'John',
        lastName: 'Smith',
        email: 'john@example.com',
        phone: null,
        company: null,
        notes: null,
        tags: [],
      },
      correlationId,
    );

    expect(result.client.firstName).toBe('John');
    expect(result.client.lastName).toBe('Smith');
    expect(result.client.tenantId).toBe('tenant-1');
    expect(clientRepo.create).toHaveBeenCalledOnce();
    expect(auditRepo.recorded).toHaveLength(1);
    expect(auditRepo.recorded[0].eventName).toBe('client.created');
    expect(auditRepo.recorded[0].subjectType).toBe('client');
  });

  it('throws ValidationError for empty firstName', async () => {
    await expect(
      useCase.execute(
        {
          tenantId: 'tenant-1',
          userId: 'user-1',
          firstName: '   ',
          lastName: 'Smith',
          email: null,
          phone: null,
          company: null,
          notes: null,
          tags: [],
        },
        correlationId,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for empty lastName', async () => {
    await expect(
      useCase.execute(
        {
          tenantId: 'tenant-1',
          userId: 'user-1',
          firstName: 'John',
          lastName: '',
          email: null,
          phone: null,
          company: null,
          notes: null,
          tags: [],
        },
        correlationId,
      ),
    ).rejects.toThrow(ValidationError);
  });
});

describe('UpdateClientUseCase', () => {
  let clientRepo: ClientRepository;
  let auditRepo: ReturnType<typeof makeAuditRepo>;
  let useCase: UpdateClientUseCase;

  beforeEach(() => {
    clientRepo = makeClientRepo();
    auditRepo = makeAuditRepo();
    useCase = new UpdateClientUseCase(clientRepo, auditRepo);
  });

  it('updates client and records audit event', async () => {
    const result = await useCase.execute(
      { tenantId: 'tenant-1', userId: 'user-1', id: 'client-1', firstName: 'Jane' },
      correlationId,
    );

    expect(result.client).toBeDefined();
    expect(clientRepo.update).toHaveBeenCalledOnce();
    expect(auditRepo.recorded).toHaveLength(1);
    expect(auditRepo.recorded[0].eventName).toBe('client.updated');
  });

  it('throws NotFoundError when client does not exist', async () => {
    clientRepo = makeClientRepo({
      update: vi.fn(async () => null),
    });
    useCase = new UpdateClientUseCase(clientRepo, auditRepo);

    await expect(
      useCase.execute(
        { tenantId: 'tenant-1', userId: 'user-1', id: 'missing', firstName: 'No' },
        correlationId,
      ),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('DeactivateClientUseCase', () => {
  let clientRepo: ClientRepository;
  let propertyRepo: PropertyRepository;
  let auditRepo: ReturnType<typeof makeAuditRepo>;
  let useCase: DeactivateClientUseCase;

  beforeEach(() => {
    clientRepo = makeClientRepo();
    propertyRepo = makePropertyRepo();
    auditRepo = makeAuditRepo();
    useCase = new DeactivateClientUseCase(clientRepo, propertyRepo, auditRepo);
  });

  it('deactivates client and records audit event', async () => {
    await useCase.execute(
      { tenantId: 'tenant-1', userId: 'user-1', id: 'client-1' },
      correlationId,
    );

    expect(clientRepo.deactivate).toHaveBeenCalledWith('tenant-1', 'client-1');
    expect(auditRepo.recorded).toHaveLength(1);
    expect(auditRepo.recorded[0].eventName).toBe('client.deactivated');
  });

  it('cascades deactivation to child properties', async () => {
    propertyRepo = makePropertyRepo({
      deactivateByClientId: vi.fn(async () => 2),
    });
    useCase = new DeactivateClientUseCase(clientRepo, propertyRepo, auditRepo);

    await useCase.execute(
      { tenantId: 'tenant-1', userId: 'user-1', id: 'client-1' },
      correlationId,
    );

    expect(propertyRepo.deactivateByClientId).toHaveBeenCalledWith('tenant-1', 'client-1');
  });

  it('throws NotFoundError when client does not exist', async () => {
    clientRepo = makeClientRepo({
      deactivate: vi.fn(async () => false),
    });
    useCase = new DeactivateClientUseCase(clientRepo, propertyRepo, auditRepo);

    await expect(
      useCase.execute(
        { tenantId: 'tenant-1', userId: 'user-1', id: 'missing' },
        correlationId,
      ),
    ).rejects.toThrow(NotFoundError);
  });
});
