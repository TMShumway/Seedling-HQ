import type { ServiceItem } from '../../domain/entities/service-item.js';
import type { UnitType } from '../../domain/types/unit-type.js';

export interface ServiceItemRepository {
  list(tenantId: string, filters?: { categoryId?: string; includeInactive?: boolean }): Promise<ServiceItem[]>;
  getById(tenantId: string, id: string): Promise<ServiceItem | null>;
  create(item: Omit<ServiceItem, 'createdAt' | 'updatedAt'>): Promise<ServiceItem>;
  update(tenantId: string, id: string, patch: Partial<Pick<ServiceItem, 'name' | 'description' | 'unitPrice' | 'unitType' | 'estimatedDurationMinutes' | 'sortOrder'>>): Promise<ServiceItem | null>;
  deactivate(tenantId: string, id: string): Promise<boolean>;
  deactivateByCategoryId(tenantId: string, categoryId: string): Promise<number>;
  countByCategoryId(tenantId: string, categoryId: string): Promise<number>;
}
