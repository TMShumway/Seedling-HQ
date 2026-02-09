import type { BusinessSettings } from '../../domain/entities/business-settings.js';
import type { BusinessHours } from '../../domain/entities/business-settings.js';

export interface UpsertBusinessSettingsInput {
  tenantId: string;
  userId: string;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  timezone: string | null;
  businessHours: BusinessHours | null;
  serviceArea: string | null;
  defaultDurationMinutes: number | null;
  description: string | null;
}

export interface UpsertBusinessSettingsOutput {
  settings: BusinessSettings;
}
