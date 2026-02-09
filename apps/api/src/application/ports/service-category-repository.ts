import type { ServiceCategory } from '../../domain/entities/service-category.js';

export interface ServiceCategoryRepository {
  list(tenantId: string, includeInactive?: boolean): Promise<ServiceCategory[]>;
  getById(tenantId: string, id: string): Promise<ServiceCategory | null>;
  create(category: Omit<ServiceCategory, 'createdAt' | 'updatedAt'>): Promise<ServiceCategory>;
  update(tenantId: string, id: string, patch: Partial<Pick<ServiceCategory, 'name' | 'description' | 'sortOrder'>>): Promise<ServiceCategory | null>;
  deactivate(tenantId: string, id: string): Promise<boolean>;
}
