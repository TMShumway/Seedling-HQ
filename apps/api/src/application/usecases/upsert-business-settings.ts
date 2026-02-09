import { randomUUID } from 'node:crypto';
import type { BusinessSettingsRepository } from '../ports/business-settings-repository.js';
import type { AuditEventRepository } from '../ports/audit-event-repository.js';
import type {
  UpsertBusinessSettingsInput,
  UpsertBusinessSettingsOutput,
} from '../dto/upsert-business-settings-dto.js';

export class UpsertBusinessSettingsUseCase {
  constructor(
    private settingsRepo: BusinessSettingsRepository,
    private auditRepo: AuditEventRepository,
  ) {}

  async execute(
    input: UpsertBusinessSettingsInput,
    correlationId: string,
  ): Promise<UpsertBusinessSettingsOutput> {
    const existing = await this.settingsRepo.getByTenantId(input.tenantId);
    const id = existing?.id ?? randomUUID();
    const eventName = existing ? 'business_settings.updated' : 'business_settings.created';

    const settings = await this.settingsRepo.upsert({
      id,
      tenantId: input.tenantId,
      phone: input.phone,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      city: input.city,
      state: input.state,
      zip: input.zip,
      timezone: input.timezone,
      businessHours: input.businessHours,
      serviceArea: input.serviceArea,
      defaultDurationMinutes: input.defaultDurationMinutes,
      description: input.description,
    });

    await this.auditRepo.record({
      id: randomUUID(),
      tenantId: input.tenantId,
      principalType: 'internal',
      principalId: input.userId,
      eventName,
      subjectType: 'business_settings',
      subjectId: settings.id,
      correlationId,
    });

    return { settings };
  }
}
