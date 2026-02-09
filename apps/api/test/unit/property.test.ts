import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreatePropertyUseCase } from '../../src/application/usecases/create-property.js';
import { UpdatePropertyUseCase } from '../../src/application/usecases/update-property.js';
import { DeactivatePropertyUseCase } from '../../src/application/usecases/deactivate-property.js';
import type { PropertyRepository } from '../../src/application/ports/property-repository.js';
import type { ClientRepository } from '../../src/application/ports/client-repository.js';
import type {
  AuditEventRepository,
  AuditEvent,
} from '../../src/application/ports/audit-event-repository.js';
import { ValidationError, NotFoundError } from '../../src/shared/errors.js';

function makePropertyRepo(overrides: Partial<PropertyRepository> = {}): PropertyRepository {
  return {
    listByClientId: vi.fn(async () => []),
    getById: vi.fn(async () => null),
    create: vi.fn(async (p) => ({ ...p, createdAt: new Date(), updatedAt: new Date() })),
    update: vi.fn(async (tenantId, id, patch) => ({
      id,
      tenantId,
      clientId: 'client-1',
      addressLine1: '123 Main St',
      addressLine2: null,
      city: null,
      state: null,
      zip: null,
      notes: null,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...patch,
    })),
    deactivate: vi.fn(async () => true),
    deactivateByClientId: vi.fn(async () => 0),
    ...overrides,
  };
}

function makeClientRepo(overrides: Partial<ClientRepository> = {}): ClientRepository {
  return {
    list: vi.fn(async () => ({ data: [], cursor: null, hasMore: false })),
    getById: vi.fn(async () => ({
      id: 'client-1',
      tenantId: 'tenant-1',
      firstName: 'John',
      lastName: 'Smith',
      email: null,
      phone: null,
      company: null,
      notes: null,
      tags: [],
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    create: vi.fn(async (c) => ({ ...c, createdAt: new Date(), updatedAt: new Date() })),
    update: vi.fn(async () => null),
    deactivate: vi.fn(async () => true),
    count: vi.fn(async () => 0),
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

describe('CreatePropertyUseCase', () => {
  let propertyRepo: PropertyRepository;
  let clientRepo: ClientRepository;
  let auditRepo: ReturnType<typeof makeAuditRepo>;
  let useCase: CreatePropertyUseCase;

  beforeEach(() => {
    propertyRepo = makePropertyRepo();
    clientRepo = makeClientRepo();
    auditRepo = makeAuditRepo();
    useCase = new CreatePropertyUseCase(propertyRepo, clientRepo, auditRepo);
  });

  it('creates property and records audit event', async () => {
    const result = await useCase.execute(
      {
        tenantId: 'tenant-1',
        userId: 'user-1',
        clientId: 'client-1',
        addressLine1: '123 Main St',
        addressLine2: null,
        city: 'Springfield',
        state: 'IL',
        zip: '62701',
        notes: null,
      },
      correlationId,
    );

    expect(result.property.addressLine1).toBe('123 Main St');
    expect(result.property.clientId).toBe('client-1');
    expect(propertyRepo.create).toHaveBeenCalledOnce();
    expect(auditRepo.recorded).toHaveLength(1);
    expect(auditRepo.recorded[0].eventName).toBe('property.created');
    expect(auditRepo.recorded[0].subjectType).toBe('property');
  });

  it('throws ValidationError for empty addressLine1', async () => {
    await expect(
      useCase.execute(
        {
          tenantId: 'tenant-1',
          userId: 'user-1',
          clientId: 'client-1',
          addressLine1: '   ',
          addressLine2: null,
          city: null,
          state: null,
          zip: null,
          notes: null,
        },
        correlationId,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('throws NotFoundError when client does not exist', async () => {
    clientRepo = makeClientRepo({
      getById: vi.fn(async () => null),
    });
    useCase = new CreatePropertyUseCase(propertyRepo, clientRepo, auditRepo);

    await expect(
      useCase.execute(
        {
          tenantId: 'tenant-1',
          userId: 'user-1',
          clientId: 'missing-client',
          addressLine1: '123 Main St',
          addressLine2: null,
          city: null,
          state: null,
          zip: null,
          notes: null,
        },
        correlationId,
      ),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('UpdatePropertyUseCase', () => {
  let propertyRepo: PropertyRepository;
  let auditRepo: ReturnType<typeof makeAuditRepo>;
  let useCase: UpdatePropertyUseCase;

  beforeEach(() => {
    propertyRepo = makePropertyRepo();
    auditRepo = makeAuditRepo();
    useCase = new UpdatePropertyUseCase(propertyRepo, auditRepo);
  });

  it('updates property and records audit event', async () => {
    const result = await useCase.execute(
      { tenantId: 'tenant-1', userId: 'user-1', id: 'prop-1', addressLine1: '456 Oak Ave' },
      correlationId,
    );

    expect(result.property).toBeDefined();
    expect(propertyRepo.update).toHaveBeenCalledOnce();
    expect(auditRepo.recorded).toHaveLength(1);
    expect(auditRepo.recorded[0].eventName).toBe('property.updated');
  });

  it('throws NotFoundError when property does not exist', async () => {
    propertyRepo = makePropertyRepo({
      update: vi.fn(async () => null),
    });
    useCase = new UpdatePropertyUseCase(propertyRepo, auditRepo);

    await expect(
      useCase.execute(
        { tenantId: 'tenant-1', userId: 'user-1', id: 'missing', addressLine1: '456 Oak Ave' },
        correlationId,
      ),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ValidationError for whitespace-only addressLine1', async () => {
    await expect(
      useCase.execute(
        { tenantId: 'tenant-1', userId: 'user-1', id: 'prop-1', addressLine1: '   ' },
        correlationId,
      ),
    ).rejects.toThrow(ValidationError);
  });
});

describe('DeactivatePropertyUseCase', () => {
  let propertyRepo: PropertyRepository;
  let auditRepo: ReturnType<typeof makeAuditRepo>;
  let useCase: DeactivatePropertyUseCase;

  beforeEach(() => {
    propertyRepo = makePropertyRepo();
    auditRepo = makeAuditRepo();
    useCase = new DeactivatePropertyUseCase(propertyRepo, auditRepo);
  });

  it('deactivates property and records audit event', async () => {
    await useCase.execute(
      { tenantId: 'tenant-1', userId: 'user-1', id: 'prop-1' },
      correlationId,
    );

    expect(propertyRepo.deactivate).toHaveBeenCalledWith('tenant-1', 'prop-1');
    expect(auditRepo.recorded).toHaveLength(1);
    expect(auditRepo.recorded[0].eventName).toBe('property.deactivated');
  });

  it('throws NotFoundError when property does not exist', async () => {
    propertyRepo = makePropertyRepo({
      deactivate: vi.fn(async () => false),
    });
    useCase = new DeactivatePropertyUseCase(propertyRepo, auditRepo);

    await expect(
      useCase.execute(
        { tenantId: 'tenant-1', userId: 'user-1', id: 'missing' },
        correlationId,
      ),
    ).rejects.toThrow(NotFoundError);
  });
});
