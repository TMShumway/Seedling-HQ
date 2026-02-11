import type { User } from '../../domain/entities/user.js';

export interface UserWithTenant {
  user: User;
  tenantName: string;
}

export interface UserRepository {
  create(user: Omit<User, 'createdAt' | 'updatedAt'>): Promise<User>;
  getById(tenantId: string, id: string): Promise<User | null>;
  getByIdGlobal(id: string): Promise<User | null>;
  getByEmail(tenantId: string, email: string): Promise<User | null>;
  getOwnerByTenantId(tenantId: string): Promise<User | null>;
  listActiveByEmail(email: string): Promise<UserWithTenant[]>;
}
