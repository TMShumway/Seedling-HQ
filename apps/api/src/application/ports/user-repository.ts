import type { User } from '../../domain/entities/user.js';
import type { Role } from '../../domain/types/roles.js';
import type { UserStatus } from '../../domain/types/status.js';

export interface UserWithTenant {
  user: User;
  tenantName: string;
}

export interface UpdateUserFields {
  fullName?: string;
  role?: Role;
  status?: UserStatus;
  passwordHash?: string | null;
}

export interface UserRepository {
  create(user: Omit<User, 'createdAt' | 'updatedAt'>): Promise<User>;
  getById(tenantId: string, id: string): Promise<User | null>;
  getByIdGlobal(id: string): Promise<User | null>;
  getByEmail(tenantId: string, email: string): Promise<User | null>;
  getOwnerByTenantId(tenantId: string): Promise<User | null>;
  listActiveByEmail(email: string): Promise<UserWithTenant[]>;
  listByTenantId(tenantId: string): Promise<User[]>;
  updatePasswordHash(tenantId: string, id: string, passwordHash: string): Promise<User | null>;
  updateStatus(tenantId: string, id: string, status: UserStatus): Promise<User | null>;
  updateUser(tenantId: string, id: string, fields: UpdateUserFields): Promise<User | null>;
}
