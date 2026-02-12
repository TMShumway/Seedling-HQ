import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateUserUseCase } from '../../src/application/usecases/create-user.js';
import type { UserRepository } from '../../src/application/ports/user-repository.js';
import type { AuditEventRepository, AuditEvent } from '../../src/application/ports/audit-event-repository.js';
import type { UnitOfWork } from '../../src/application/ports/unit-of-work.js';
import type { CognitoProvisioner } from '../../src/application/ports/cognito-provisioner.js';
import type { AppConfig } from '../../src/shared/config.js';
import type { User } from '../../src/domain/entities/user.js';
import { ConflictError, ForbiddenError, ValidationError } from '../../src/shared/errors.js';

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    API_PORT: 4000,
    NODE_ENV: 'test',
    AUTH_MODE: 'local',
    DEV_AUTH_TENANT_ID: '',
    DEV_AUTH_USER_ID: '',
    DEV_AUTH_ROLE: '',
    NOTIFICATION_ENABLED: false,
    SMTP_HOST: 'localhost',
    SMTP_PORT: 1025,
    SMTP_FROM: 'noreply@seedling.local',
    APP_BASE_URL: 'http://localhost:5173',
    SECURE_LINK_HMAC_SECRET: 'test-secret-for-unit-tests',
    COGNITO_USER_POOL_ID: '',
    COGNITO_CLIENT_ID: '',
    COGNITO_REGION: '',
    ...overrides,
  };
}

function makeUserRepo(overrides: Partial<UserRepository> = {}): UserRepository {
  return {
    create: vi.fn(async (u) => ({ ...u, createdAt: new Date(), updatedAt: new Date() })),
    getById: vi.fn(async () => null),
    getByIdGlobal: vi.fn(async () => null),
    getByEmail: vi.fn(async () => null),
    getOwnerByTenantId: vi.fn(async () => null),
    listActiveByEmail: vi.fn(async () => []),
    listByTenantId: vi.fn(async () => []),
    updatePasswordHash: vi.fn(async () => null),
    updateStatus: vi.fn(async () => null),
    updateUser: vi.fn(async (tenantId, id, fields) => ({
      id,
      tenantId,
      email: 'test@example.com',
      fullName: fields.fullName ?? 'Test User',
      role: fields.role ?? 'member',
      passwordHash: fields.passwordHash ?? null,
      status: fields.status ?? 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as User)),
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

function makeUnitOfWork(userRepo: UserRepository, auditRepo: AuditEventRepository): UnitOfWork {
  return {
    run: async (fn) => fn({
      tenantRepo: {} as any,
      userRepo,
      auditRepo,
      clientRepo: {} as any,
      propertyRepo: {} as any,
      requestRepo: {} as any,
      quoteRepo: {} as any,
      secureLinkTokenRepo: {} as any,
    }),
  };
}

function makeCognitoProvisioner(overrides: Partial<CognitoProvisioner> = {}): CognitoProvisioner {
  return {
    provisionUser: vi.fn(async () => {}),
    setUserPassword: vi.fn(async () => {}),
    ...overrides,
  };
}

const baseInput = {
  tenantId: 'tenant-1',
  email: 'newuser@example.com',
  fullName: 'New User',
  role: 'member' as const,
  password: 'test-password-123',
  callerRole: 'owner',
  callerUserId: 'caller-1',
  correlationId: 'corr-1',
};

describe('CreateUserUseCase', () => {
  let userRepo: UserRepository;
  let auditRepo: ReturnType<typeof makeAuditRepo>;
  let uow: UnitOfWork;
  let config: AppConfig;

  beforeEach(() => {
    userRepo = makeUserRepo();
    auditRepo = makeAuditRepo();
    uow = makeUnitOfWork(userRepo, auditRepo);
    config = makeConfig();
  });

  it('creates user with hashed password in local mode', async () => {
    const useCase = new CreateUserUseCase(config);
    const { user } = await useCase.execute(baseInput, uow, userRepo);

    expect(user.email).toBe('newuser@example.com');
    expect(user.fullName).toBe('New User');
    expect(user.role).toBe('member');
    expect(user.status).toBe('active');
    expect(user.passwordHash).toMatch(/^scrypt:/);
  });

  it('records user.created audit event', async () => {
    const useCase = new CreateUserUseCase(config);
    await useCase.execute(baseInput, uow, userRepo);

    const created = auditRepo.recorded.find((e) => e.eventName === 'user.created');
    expect(created).toBeDefined();
    expect(created!.tenantId).toBe('tenant-1');
    expect(created!.subjectType).toBe('user');
    expect(created!.principalId).toBe('caller-1');
  });

  it('calls provisionUser in cognito mode', async () => {
    config = makeConfig({ AUTH_MODE: 'cognito' });
    const provisioner = makeCognitoProvisioner();
    const useCase = new CreateUserUseCase(config, provisioner);

    const { user } = await useCase.execute({ ...baseInput, password: undefined }, uow, userRepo);

    expect(provisioner.provisionUser).toHaveBeenCalledWith({
      username: user.id,
      email: 'newuser@example.com',
      tenantId: 'tenant-1',
      groupName: 'member',
    });
  });

  it('rejects role=owner', async () => {
    const useCase = new CreateUserUseCase(config);
    await expect(
      useCase.execute({ ...baseInput, role: 'owner' as any }, uow, userRepo),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects admin creating admin (ForbiddenError)', async () => {
    const useCase = new CreateUserUseCase(config);
    await expect(
      useCase.execute({ ...baseInput, callerRole: 'admin', role: 'admin' }, uow, userRepo),
    ).rejects.toThrow(ForbiddenError);
  });

  it('rejects member creating anyone (ForbiddenError)', async () => {
    const useCase = new CreateUserUseCase(config);
    await expect(
      useCase.execute({ ...baseInput, callerRole: 'member' }, uow, userRepo),
    ).rejects.toThrow(ForbiddenError);
  });

  it('throws ConflictError for duplicate active email', async () => {
    const existingUser: User = {
      id: 'existing-1',
      tenantId: 'tenant-1',
      email: 'newuser@example.com',
      fullName: 'Existing User',
      role: 'member',
      passwordHash: null,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    userRepo = makeUserRepo({ getByEmail: vi.fn(async () => existingUser) });
    uow = makeUnitOfWork(userRepo, auditRepo);

    const useCase = new CreateUserUseCase(config);
    await expect(useCase.execute(baseInput, uow, userRepo)).rejects.toThrow(ConflictError);
  });

  it('re-provisions disabled user with same email — reuses existing userId', async () => {
    const disabledUser: User = {
      id: 'disabled-1',
      tenantId: 'tenant-1',
      email: 'newuser@example.com',
      fullName: 'Old Name',
      role: 'admin',
      passwordHash: null,
      status: 'disabled',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    userRepo = makeUserRepo({ getByEmail: vi.fn(async () => disabledUser) });
    uow = makeUnitOfWork(userRepo, auditRepo);

    const useCase = new CreateUserUseCase(config);
    const { user } = await useCase.execute(baseInput, uow, userRepo);

    // Reuses existing ID
    expect(user.id).toBe('disabled-1');
    expect(userRepo.updateUser).toHaveBeenCalledWith('tenant-1', 'disabled-1', {
      fullName: 'New User',
      role: 'member',
      status: 'active',
      passwordHash: expect.stringMatching(/^scrypt:/),
    });

    // Records re-provision audit event
    const reprov = auditRepo.recorded.find((e) => e.eventName === 'user.reprovisioned');
    expect(reprov).toBeDefined();
    expect(reprov!.subjectId).toBe('disabled-1');
  });

  it('calls provisionUser with existing userId on re-provision', async () => {
    config = makeConfig({ AUTH_MODE: 'cognito' });
    const provisioner = makeCognitoProvisioner();
    const disabledUser: User = {
      id: 'disabled-1',
      tenantId: 'tenant-1',
      email: 'newuser@example.com',
      fullName: 'Old Name',
      role: 'admin',
      passwordHash: null,
      status: 'disabled',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    userRepo = makeUserRepo({ getByEmail: vi.fn(async () => disabledUser) });
    uow = makeUnitOfWork(userRepo, auditRepo);

    const useCase = new CreateUserUseCase(config, provisioner);
    await useCase.execute({ ...baseInput, password: undefined }, uow, userRepo);

    expect(provisioner.provisionUser).toHaveBeenCalledWith({
      username: 'disabled-1',
      email: 'newuser@example.com',
      tenantId: 'tenant-1',
      groupName: 'member',
    });
  });

  it('marks user disabled when Cognito provisioning fails on new user', async () => {
    config = makeConfig({ AUTH_MODE: 'cognito' });
    const provisioner = makeCognitoProvisioner({
      provisionUser: vi.fn(async () => { throw new Error('Cognito unavailable'); }),
    });
    const useCase = new CreateUserUseCase(config, provisioner);

    await expect(useCase.execute({ ...baseInput, password: undefined }, uow, userRepo)).rejects.toThrow(
      /Cognito provisioning failed/,
    );

    expect(userRepo.updateStatus).toHaveBeenCalledWith('tenant-1', expect.any(String), 'disabled');
  });

  it('keeps user disabled when Cognito re-provision fails', async () => {
    config = makeConfig({ AUTH_MODE: 'cognito' });
    const provisioner = makeCognitoProvisioner({
      provisionUser: vi.fn(async () => { throw new Error('Cognito unavailable'); }),
    });
    const disabledUser: User = {
      id: 'disabled-1',
      tenantId: 'tenant-1',
      email: 'newuser@example.com',
      fullName: 'Old Name',
      role: 'admin',
      passwordHash: null,
      status: 'disabled',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    userRepo = makeUserRepo({ getByEmail: vi.fn(async () => disabledUser) });
    uow = makeUnitOfWork(userRepo, auditRepo);

    const useCase = new CreateUserUseCase(config, provisioner);
    await expect(useCase.execute({ ...baseInput, password: undefined }, uow, userRepo)).rejects.toThrow(
      /Cognito provisioning failed/,
    );

    expect(userRepo.updateStatus).toHaveBeenCalledWith('tenant-1', 'disabled-1', 'disabled');
  });

  it('owner can create admin', async () => {
    const useCase = new CreateUserUseCase(config);
    const { user } = await useCase.execute({ ...baseInput, role: 'admin' }, uow, userRepo);
    expect(user.role).toBe('admin');
  });

  it('admin can create member', async () => {
    const useCase = new CreateUserUseCase(config);
    const { user } = await useCase.execute(
      { ...baseInput, callerRole: 'admin', role: 'member' },
      uow,
      userRepo,
    );
    expect(user.role).toBe('member');
  });
});
