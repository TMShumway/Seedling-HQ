import type { ServiceItem } from '../../domain/entities/service-item.js';
import type { UnitType } from '../../domain/types/unit-type.js';

export interface CreateServiceItemInput {
  tenantId: string;
  userId: string;
  categoryId: string;
  name: string;
  description: string | null;
  unitPrice: number;
  unitType: UnitType;
  estimatedDurationMinutes: number | null;
  sortOrder?: number;
}

export interface UpdateServiceItemInput {
  tenantId: string;
  userId: string;
  id: string;
  name?: string;
  description?: string | null;
  unitPrice?: number;
  unitType?: UnitType;
  estimatedDurationMinutes?: number | null;
  sortOrder?: number;
}

export interface DeactivateServiceItemInput {
  tenantId: string;
  userId: string;
  id: string;
}

export interface ServiceItemOutput {
  item: ServiceItem;
}
