import type { ServiceCategory } from '../../domain/entities/service-category.js';

export interface CreateServiceCategoryInput {
  tenantId: string;
  userId: string;
  name: string;
  description: string | null;
  sortOrder?: number;
}

export interface UpdateServiceCategoryInput {
  tenantId: string;
  userId: string;
  id: string;
  name?: string;
  description?: string | null;
  sortOrder?: number;
}

export interface DeactivateServiceCategoryInput {
  tenantId: string;
  userId: string;
  id: string;
}

export interface ServiceCategoryOutput {
  category: ServiceCategory;
}
