import type { UnitType } from '../types/unit-type.js';

export interface ServiceItem {
  id: string;
  tenantId: string;
  categoryId: string;
  name: string;
  description: string | null;
  unitPrice: number;
  unitType: UnitType;
  estimatedDurationMinutes: number | null;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
