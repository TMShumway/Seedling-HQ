import { randomUUID } from 'node:crypto';
import type { TenantRepository } from '../ports/tenant-repository.js';
import type { UserRepository } from '../ports/user-repository.js';
import type { AuditEventRepository } from '../ports/audit-event-repository.js';
import type { CreateTenantInput, CreateTenantOutput } from '../dto/create-tenant-dto.js';
import { ConflictError } from '../../shared/errors.js';

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export class CreateTenantUseCase {
  constructor(
    private tenantRepo: TenantRepository,
    private userRepo: UserRepository,
    private auditRepo: AuditEventRepository,
  ) {}

  async execute(input: CreateTenantInput, correlationId: string): Promise<CreateTenantOutput> {
    const slug = slugify(input.businessName);

    const existing = await this.tenantRepo.getBySlug(slug);
    if (existing) {
      throw new ConflictError(`Tenant with slug "${slug}" already exists`);
    }

    const tenantId = randomUUID();
    const userId = randomUUID();

    const tenant = await this.tenantRepo.create({
      id: tenantId,
      slug,
      name: input.businessName,
      status: 'active',
    });

    const user = await this.userRepo.create({
      id: userId,
      tenantId,
      email: input.ownerEmail,
      fullName: input.ownerFullName,
      role: 'owner',
      status: 'active',
    });

    await this.auditRepo.record({
      id: randomUUID(),
      tenantId,
      principalType: 'internal',
      principalId: userId,
      eventName: 'tenant.created',
      subjectType: 'tenant',
      subjectId: tenantId,
      correlationId,
    });

    await this.auditRepo.record({
      id: randomUUID(),
      tenantId,
      principalType: 'internal',
      principalId: userId,
      eventName: 'auth.signup',
      subjectType: 'user',
      subjectId: userId,
      correlationId,
    });

    return { tenant, user };
  }
}
