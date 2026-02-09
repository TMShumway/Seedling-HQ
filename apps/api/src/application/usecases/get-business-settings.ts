import type { BusinessSettingsRepository } from '../ports/business-settings-repository.js';
import type { BusinessSettings } from '../../domain/entities/business-settings.js';

export class GetBusinessSettingsUseCase {
  constructor(private settingsRepo: BusinessSettingsRepository) {}

  async execute(tenantId: string): Promise<BusinessSettings | null> {
    return this.settingsRepo.getByTenantId(tenantId);
  }
}
