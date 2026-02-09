import type { BusinessSettings } from '../../domain/entities/business-settings.js';

export interface BusinessSettingsRepository {
  getByTenantId(tenantId: string): Promise<BusinessSettings | null>;
  upsert(settings: Omit<BusinessSettings, 'createdAt' | 'updatedAt'>): Promise<BusinessSettings>;
}
