export interface Client {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  tags: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
