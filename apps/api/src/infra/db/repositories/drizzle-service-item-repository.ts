import { eq, and, asc, sql } from 'drizzle-orm';
import type { ServiceItemRepository } from '../../../application/ports/service-item-repository.js';
import type { ServiceItem } from '../../../domain/entities/service-item.js';
import type { UnitType } from '../../../domain/types/unit-type.js';
import type { Database } from '../client.js';
import { serviceItems } from '../schema.js';

function toEntity(row: typeof serviceItems.$inferSelect): ServiceItem {
  return {
    id: row.id,
    tenantId: row.tenantId,
    categoryId: row.categoryId,
    name: row.name,
    description: row.description,
    unitPrice: row.unitPrice,
    unitType: row.unitType as UnitType,
    estimatedDurationMinutes: row.estimatedDurationMinutes,
    active: row.active,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleServiceItemRepository implements ServiceItemRepository {
  constructor(private db: Database) {}

  async list(
    tenantId: string,
    filters?: { categoryId?: string; includeInactive?: boolean },
  ): Promise<ServiceItem[]> {
    const conditions = [eq(serviceItems.tenantId, tenantId)];
    if (filters?.categoryId) {
      conditions.push(eq(serviceItems.categoryId, filters.categoryId));
    }
    if (!filters?.includeInactive) {
      conditions.push(eq(serviceItems.active, true));
    }
    const rows = await this.db
      .select()
      .from(serviceItems)
      .where(and(...conditions))
      .orderBy(asc(serviceItems.sortOrder), asc(serviceItems.name));
    return rows.map(toEntity);
  }

  async getById(tenantId: string, id: string): Promise<ServiceItem | null> {
    const rows = await this.db
      .select()
      .from(serviceItems)
      .where(and(eq(serviceItems.tenantId, tenantId), eq(serviceItems.id, id)));
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async create(item: Omit<ServiceItem, 'createdAt' | 'updatedAt'>): Promise<ServiceItem> {
    const [row] = await this.db
      .insert(serviceItems)
      .values({
        id: item.id,
        tenantId: item.tenantId,
        categoryId: item.categoryId,
        name: item.name,
        description: item.description,
        unitPrice: item.unitPrice,
        unitType: item.unitType,
        estimatedDurationMinutes: item.estimatedDurationMinutes,
        active: item.active,
        sortOrder: item.sortOrder,
      })
      .returning();
    return toEntity(row);
  }

  async update(
    tenantId: string,
    id: string,
    patch: Partial<Pick<ServiceItem, 'name' | 'description' | 'unitPrice' | 'unitType' | 'estimatedDurationMinutes' | 'sortOrder'>>,
  ): Promise<ServiceItem | null> {
    const rows = await this.db
      .update(serviceItems)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(serviceItems.tenantId, tenantId), eq(serviceItems.id, id)))
      .returning();
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async deactivate(tenantId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .update(serviceItems)
      .set({ active: false, updatedAt: new Date() })
      .where(and(eq(serviceItems.tenantId, tenantId), eq(serviceItems.id, id)))
      .returning();
    return rows.length > 0;
  }

  async deactivateByCategoryId(tenantId: string, categoryId: string): Promise<number> {
    const rows = await this.db
      .update(serviceItems)
      .set({ active: false, updatedAt: new Date() })
      .where(
        and(
          eq(serviceItems.tenantId, tenantId),
          eq(serviceItems.categoryId, categoryId),
          eq(serviceItems.active, true),
        ),
      )
      .returning();
    return rows.length;
  }

  async countByCategoryId(tenantId: string, categoryId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(serviceItems)
      .where(
        and(
          eq(serviceItems.tenantId, tenantId),
          eq(serviceItems.categoryId, categoryId),
          eq(serviceItems.active, true),
        ),
      );
    return result[0].count;
  }
}
