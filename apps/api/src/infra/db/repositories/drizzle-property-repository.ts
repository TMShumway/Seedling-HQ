import { eq, and } from 'drizzle-orm';
import type { PropertyRepository } from '../../../application/ports/property-repository.js';
import type { Property } from '../../../domain/entities/property.js';
import type { Database } from '../client.js';
import { properties } from '../schema.js';

function toEntity(row: typeof properties.$inferSelect): Property {
  return {
    id: row.id,
    tenantId: row.tenantId,
    clientId: row.clientId,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    city: row.city,
    state: row.state,
    zip: row.zip,
    notes: row.notes,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzlePropertyRepository implements PropertyRepository {
  constructor(private db: Database) {}

  async listByClientId(tenantId: string, clientId: string, includeInactive?: boolean): Promise<Property[]> {
    const conditions = [
      eq(properties.tenantId, tenantId),
      eq(properties.clientId, clientId),
    ];
    if (!includeInactive) {
      conditions.push(eq(properties.active, true));
    }
    const rows = await this.db
      .select()
      .from(properties)
      .where(and(...conditions));
    return rows.map(toEntity);
  }

  async getById(tenantId: string, id: string): Promise<Property | null> {
    const rows = await this.db
      .select()
      .from(properties)
      .where(and(eq(properties.tenantId, tenantId), eq(properties.id, id)));
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async create(property: Omit<Property, 'createdAt' | 'updatedAt'>): Promise<Property> {
    const [row] = await this.db
      .insert(properties)
      .values({
        id: property.id,
        tenantId: property.tenantId,
        clientId: property.clientId,
        addressLine1: property.addressLine1,
        addressLine2: property.addressLine2,
        city: property.city,
        state: property.state,
        zip: property.zip,
        notes: property.notes,
        active: property.active,
      })
      .returning();
    return toEntity(row);
  }

  async update(
    tenantId: string,
    id: string,
    patch: Partial<Pick<Property, 'addressLine1' | 'addressLine2' | 'city' | 'state' | 'zip' | 'notes'>>,
  ): Promise<Property | null> {
    const rows = await this.db
      .update(properties)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(properties.tenantId, tenantId), eq(properties.id, id)))
      .returning();
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async deactivate(tenantId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .update(properties)
      .set({ active: false, updatedAt: new Date() })
      .where(and(eq(properties.tenantId, tenantId), eq(properties.id, id)))
      .returning();
    return rows.length > 0;
  }

  async deactivateByClientId(tenantId: string, clientId: string): Promise<number> {
    const rows = await this.db
      .update(properties)
      .set({ active: false, updatedAt: new Date() })
      .where(
        and(
          eq(properties.tenantId, tenantId),
          eq(properties.clientId, clientId),
          eq(properties.active, true),
        ),
      )
      .returning();
    return rows.length;
  }
}
