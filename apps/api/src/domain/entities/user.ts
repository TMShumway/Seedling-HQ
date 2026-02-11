import type { Role } from '../types/roles.js';
import type { UserStatus } from '../types/status.js';

export interface User {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  role: Role;
  passwordHash: string | null;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}
