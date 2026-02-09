import type { Property } from '../../domain/entities/property.js';

export interface CreatePropertyInput {
  tenantId: string;
  userId: string;
  clientId: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
}

export interface UpdatePropertyInput {
  tenantId: string;
  userId: string;
  id: string;
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  notes?: string | null;
}

export interface DeactivatePropertyInput {
  tenantId: string;
  userId: string;
  id: string;
}

export interface PropertyOutput {
  property: Property;
}
