import { eq, and, asc } from 'drizzle-orm';
import type { ServiceCategoryRepository } from '../../../application/ports/service-category-repository.js';
import type { ServiceCategory } from '../../../domain/entities/service-category.js';
import type { Database } from '../client.js';
import { serviceCategories } from '../schema.js';

function toEntity(row: typeof serviceCategories.$inferSelect): ServiceCategory {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    description: row.description,
    sortOrder: row.sortOrder,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleServiceCategoryRepository implements ServiceCategoryRepository {
  constructor(private db: Database) {}

  async list(tenantId: string, includeInactive?: boolean): Promise<ServiceCategory[]> {
    const conditions = [eq(serviceCategories.tenantId, tenantId)];
    if (!includeInactive) {
      conditions.push(eq(serviceCategories.active, true));
    }
    const rows = await this.db
      .select()
      .from(serviceCategories)
      .where(and(...conditions))
      .orderBy(asc(serviceCategories.sortOrder), asc(serviceCategories.name));
    return rows.map(toEntity);
  }

  async getById(tenantId: string, id: string): Promise<ServiceCategory | null> {
    const rows = await this.db
      .select()
      .from(serviceCategories)
      .where(and(eq(serviceCategories.tenantId, tenantId), eq(serviceCategories.id, id)));
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async create(category: Omit<ServiceCategory, 'createdAt' | 'updatedAt'>): Promise<ServiceCategory> {
    const [row] = await this.db
      .insert(serviceCategories)
      .values({
        id: category.id,
        tenantId: category.tenantId,
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder,
        active: category.active,
      })
      .returning();
    return toEntity(row);
  }

  async update(
    tenantId: string,
    id: string,
    patch: Partial<Pick<ServiceCategory, 'name' | 'description' | 'sortOrder'>>,
  ): Promise<ServiceCategory | null> {
    const rows = await this.db
      .update(serviceCategories)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(serviceCategories.tenantId, tenantId), eq(serviceCategories.id, id)))
      .returning();
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async deactivate(tenantId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .update(serviceCategories)
      .set({ active: false, updatedAt: new Date() })
      .where(and(eq(serviceCategories.tenantId, tenantId), eq(serviceCategories.id, id)))
      .returning();
    return rows.length > 0;
  }
}
