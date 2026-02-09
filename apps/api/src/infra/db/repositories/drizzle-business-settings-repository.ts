import { eq } from 'drizzle-orm';
import type { BusinessSettingsRepository } from '../../../application/ports/business-settings-repository.js';
import type { BusinessSettings, BusinessHours } from '../../../domain/entities/business-settings.js';
import type { Database } from '../client.js';
import { businessSettings } from '../schema.js';

function toEntity(row: typeof businessSettings.$inferSelect): BusinessSettings {
  return {
    id: row.id,
    tenantId: row.tenantId,
    phone: row.phone,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    city: row.city,
    state: row.state,
    zip: row.zip,
    timezone: row.timezone,
    businessHours: row.businessHours as BusinessHours | null,
    serviceArea: row.serviceArea,
    defaultDurationMinutes: row.defaultDurationMinutes,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleBusinessSettingsRepository implements BusinessSettingsRepository {
  constructor(private db: Database) {}

  async getByTenantId(tenantId: string): Promise<BusinessSettings | null> {
    const rows = await this.db
      .select()
      .from(businessSettings)
      .where(eq(businessSettings.tenantId, tenantId));
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async upsert(
    settings: Omit<BusinessSettings, 'createdAt' | 'updatedAt'>,
  ): Promise<BusinessSettings> {
    const [row] = await this.db
      .insert(businessSettings)
      .values({
        id: settings.id,
        tenantId: settings.tenantId,
        phone: settings.phone,
        addressLine1: settings.addressLine1,
        addressLine2: settings.addressLine2,
        city: settings.city,
        state: settings.state,
        zip: settings.zip,
        timezone: settings.timezone,
        businessHours: settings.businessHours,
        serviceArea: settings.serviceArea,
        defaultDurationMinutes: settings.defaultDurationMinutes,
        description: settings.description,
      })
      .onConflictDoUpdate({
        target: businessSettings.tenantId,
        set: {
          phone: settings.phone,
          addressLine1: settings.addressLine1,
          addressLine2: settings.addressLine2,
          city: settings.city,
          state: settings.state,
          zip: settings.zip,
          timezone: settings.timezone,
          businessHours: settings.businessHours,
          serviceArea: settings.serviceArea,
          defaultDurationMinutes: settings.defaultDurationMinutes,
          description: settings.description,
          updatedAt: new Date(),
        },
      })
      .returning();
    return toEntity(row);
  }
}
