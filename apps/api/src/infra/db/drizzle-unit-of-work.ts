import type { UnitOfWork, TransactionRepos } from '../../application/ports/unit-of-work.js';
import type { Database } from './client.js';
import { DrizzleTenantRepository } from './repositories/drizzle-tenant-repository.js';
import { DrizzleUserRepository } from './repositories/drizzle-user-repository.js';
import { DrizzleAuditEventRepository } from './repositories/drizzle-audit-event-repository.js';

export class DrizzleUnitOfWork implements UnitOfWork {
  constructor(private db: Database) {}

  async run<T>(fn: (repos: TransactionRepos) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      return fn({
        tenantRepo: new DrizzleTenantRepository(tx),
        userRepo: new DrizzleUserRepository(tx),
        auditRepo: new DrizzleAuditEventRepository(tx),
      });
    });
  }
}
