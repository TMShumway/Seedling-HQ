import type { Client } from '../../domain/entities/client.js';

export interface CreateClientInput {
  tenantId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  tags: string[];
}

export interface UpdateClientInput {
  tenantId: string;
  userId: string;
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  notes?: string | null;
  tags?: string[];
}

export interface DeactivateClientInput {
  tenantId: string;
  userId: string;
  id: string;
}

export interface ClientOutput {
  client: Client;
}
