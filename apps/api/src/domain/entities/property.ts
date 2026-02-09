export interface Property {
  id: string;
  tenantId: string;
  clientId: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
