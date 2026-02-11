import type { Tenant } from '../../domain/entities/tenant.js';
import type { User } from '../../domain/entities/user.js';

export interface CreateTenantInput {
  businessName: string;
  ownerEmail: string;
  ownerFullName: string;
  ownerPassword: string;
}

export interface CreateTenantOutput {
  tenant: Tenant;
  user: User;
}
