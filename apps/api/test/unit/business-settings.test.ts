import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpsertBusinessSettingsUseCase } from '../../src/application/usecases/upsert-business-settings.js';
import { GetBusinessSettingsUseCase } from '../../src/application/usecases/get-business-settings.js';
import type { BusinessSettingsRepository } from '../../src/application/ports/business-settings-repository.js';
import type {
  AuditEventRepository,
  AuditEvent,
} from '../../src/application/ports/audit-event-repository.js';
import type { BusinessSettings, BusinessHours } from '../../src/domain/entities/business-settings.js';

const DEFAULT_HOURS: BusinessHours = {
  monday: { open: '08:00', close: '17:00', closed: false },
  tuesday: { open: '08:00', close: '17:00', closed: false },
  wednesday: { open: '08:00', close: '17:00', closed: false },
  thursday: { open: '08:00', close: '17:00', closed: false },
  friday: { open: '08:00', close: '17:00', closed: false },
  saturday: { open: '09:00', close: '13:00', closed: false },
  sunday: { open: null, close: null, closed: true },
};

function makeSettingsRepo(
  overrides: Partial<BusinessSettingsRepository> = {},
): BusinessSettingsRepository {
  return {
    getByTenantId: vi.fn(async () => null),
    upsert: vi.fn(async (s) => ({
      ...s,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
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

const validInput = {
  tenantId: 'tenant-1',
  userId: 'user-1',
  phone: '(555) 123-4567',
  addressLine1: '123 Main St',
  addressLine2: null,
  city: 'Springfield',
  state: 'IL',
  zip: '62701',
  timezone: 'America/Chicago',
  businessHours: DEFAULT_HOURS,
  serviceArea: 'Springfield area',
  defaultDurationMinutes: 60,
  description: 'A landscaping business',
};

const correlationId = 'corr-456';

describe('UpsertBusinessSettingsUseCase', () => {
  let settingsRepo: BusinessSettingsRepository;
  let auditRepo: ReturnType<typeof makeAuditRepo>;
  let useCase: UpsertBusinessSettingsUseCase;

  beforeEach(() => {
    settingsRepo = makeSettingsRepo();
    auditRepo = makeAuditRepo();
    useCase = new UpsertBusinessSettingsUseCase(settingsRepo, auditRepo);
  });

  it('creates new settings on first upsert', async () => {
    const result = await useCase.execute(validInput, correlationId);

    expect(result.settings.tenantId).toBe('tenant-1');
    expect(result.settings.phone).toBe('(555) 123-4567');
    expect(result.settings.businessHours).toEqual(DEFAULT_HOURS);
    expect(result.settings.defaultDurationMinutes).toBe(60);
    expect(settingsRepo.upsert).toHaveBeenCalledOnce();
  });

  it('always generates a new UUID for upsert (DB conflict resolution preserves original)', async () => {
    await useCase.execute(validInput, correlationId);

    const upsertCall = vi.mocked(settingsRepo.upsert).mock.calls[0][0];
    expect(upsertCall.id).toBeDefined();
    expect(typeof upsertCall.id).toBe('string');
    expect(upsertCall.id.length).toBe(36); // UUID format
  });

  it('records business_settings.created audit event on first save', async () => {
    await useCase.execute(validInput, correlationId);

    expect(auditRepo.recorded).toHaveLength(1);
    const event = auditRepo.recorded[0];
    expect(event.eventName).toBe('business_settings.created');
    expect(event.subjectType).toBe('business_settings');
    expect(event.tenantId).toBe('tenant-1');
    expect(event.principalId).toBe('user-1');
    expect(event.correlationId).toBe(correlationId);
  });

  it('records business_settings.updated audit event when updatedAt differs from createdAt', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const updatedAt = new Date('2026-02-08T12:00:00Z');
    settingsRepo = makeSettingsRepo({
      upsert: vi.fn(async (s) => ({ ...s, createdAt, updatedAt })),
    });
    useCase = new UpsertBusinessSettingsUseCase(settingsRepo, auditRepo);

    await useCase.execute(validInput, correlationId);

    expect(auditRepo.recorded).toHaveLength(1);
    expect(auditRepo.recorded[0].eventName).toBe('business_settings.updated');
  });

  it('passes all fields to repository upsert', async () => {
    await useCase.execute(validInput, correlationId);

    expect(settingsRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        phone: '(555) 123-4567',
        addressLine1: '123 Main St',
        addressLine2: null,
        city: 'Springfield',
        state: 'IL',
        zip: '62701',
        timezone: 'America/Chicago',
        businessHours: DEFAULT_HOURS,
        serviceArea: 'Springfield area',
        defaultDurationMinutes: 60,
        description: 'A landscaping business',
      }),
    );
  });
});

describe('GetBusinessSettingsUseCase', () => {
  it('returns settings when they exist', async () => {
    const existingSettings: BusinessSettings = {
      id: 'settings-1',
      tenantId: 'tenant-1',
      phone: '(555) 123-4567',
      addressLine1: '123 Main St',
      addressLine2: null,
      city: 'Springfield',
      state: 'IL',
      zip: '62701',
      timezone: 'America/Chicago',
      businessHours: DEFAULT_HOURS,
      serviceArea: 'Springfield area',
      defaultDurationMinutes: 60,
      description: 'Test',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const settingsRepo = makeSettingsRepo({
      getByTenantId: vi.fn(async () => existingSettings),
    });
    const useCase = new GetBusinessSettingsUseCase(settingsRepo);

    const result = await useCase.execute('tenant-1');

    expect(result).toEqual(existingSettings);
    expect(settingsRepo.getByTenantId).toHaveBeenCalledWith('tenant-1');
  });

  it('returns null when no settings exist', async () => {
    const settingsRepo = makeSettingsRepo();
    const useCase = new GetBusinessSettingsUseCase(settingsRepo);

    const result = await useCase.execute('tenant-1');

    expect(result).toBeNull();
  });
});
