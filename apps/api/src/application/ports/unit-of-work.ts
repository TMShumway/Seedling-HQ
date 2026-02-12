import type { TenantRepository } from './tenant-repository.js';
import type { UserRepository } from './user-repository.js';
import type { AuditEventRepository } from './audit-event-repository.js';
import type { ClientRepository } from './client-repository.js';
import type { PropertyRepository } from './property-repository.js';
import type { RequestRepository } from './request-repository.js';
import type { QuoteRepository } from './quote-repository.js';
import type { SecureLinkTokenRepository } from './secure-link-token-repository.js';
import type { JobRepository } from './job-repository.js';
import type { VisitRepository } from './visit-repository.js';

export interface TransactionRepos {
  tenantRepo: TenantRepository;
  userRepo: UserRepository;
  auditRepo: AuditEventRepository;
  clientRepo: ClientRepository;
  propertyRepo: PropertyRepository;
  requestRepo: RequestRepository;
  quoteRepo: QuoteRepository;
  secureLinkTokenRepo: SecureLinkTokenRepository;
  jobRepo: JobRepository;
  visitRepo: VisitRepository;
}

export interface UnitOfWork {
  run<T>(fn: (repos: TransactionRepos) => Promise<T>): Promise<T>;
}
