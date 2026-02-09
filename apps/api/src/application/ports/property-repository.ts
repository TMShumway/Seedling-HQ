import type { Property } from '../../domain/entities/property.js';

export interface PropertyRepository {
  listByClientId(tenantId: string, clientId: string, includeInactive?: boolean): Promise<Property[]>;
  getById(tenantId: string, id: string): Promise<Property | null>;
  create(property: Omit<Property, 'createdAt' | 'updatedAt'>): Promise<Property>;
  update(
    tenantId: string,
    id: string,
    patch: Partial<Pick<Property, 'addressLine1' | 'addressLine2' | 'city' | 'state' | 'zip' | 'notes'>>,
  ): Promise<Property | null>;
  deactivate(tenantId: string, id: string): Promise<boolean>;
  deactivateByClientId(tenantId: string, clientId: string): Promise<number>;
}
