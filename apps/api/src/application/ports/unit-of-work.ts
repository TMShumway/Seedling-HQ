import type { TenantRepository } from './tenant-repository.js';
import type { UserRepository } from './user-repository.js';
import type { AuditEventRepository } from './audit-event-repository.js';

export interface TransactionRepos {
  tenantRepo: TenantRepository;
  userRepo: UserRepository;
  auditRepo: AuditEventRepository;
}

export interface UnitOfWork {
  run<T>(fn: (repos: TransactionRepos) => Promise<T>): Promise<T>;
}
