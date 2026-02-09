import type { UnitOfWork, TransactionRepos } from '../../application/ports/unit-of-work.js';
import type { Database } from './client.js';
import { DrizzleTenantRepository } from './repositories/drizzle-tenant-repository.js';
import { DrizzleUserRepository } from './repositories/drizzle-user-repository.js';
import { DrizzleAuditEventRepository } from './repositories/drizzle-audit-event-repository.js';
import { DrizzleClientRepository } from './repositories/drizzle-client-repository.js';
import { DrizzlePropertyRepository } from './repositories/drizzle-property-repository.js';
import { DrizzleRequestRepository } from './repositories/drizzle-request-repository.js';
import { DrizzleQuoteRepository } from './repositories/drizzle-quote-repository.js';

export class DrizzleUnitOfWork implements UnitOfWork {
  constructor(private db: Database) {}

  async run<T>(fn: (repos: TransactionRepos) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      return fn({
        tenantRepo: new DrizzleTenantRepository(tx),
        userRepo: new DrizzleUserRepository(tx),
        auditRepo: new DrizzleAuditEventRepository(tx),
        clientRepo: new DrizzleClientRepository(tx),
        propertyRepo: new DrizzlePropertyRepository(tx),
        requestRepo: new DrizzleRequestRepository(tx),
        quoteRepo: new DrizzleQuoteRepository(tx),
      });
    });
  }
}
