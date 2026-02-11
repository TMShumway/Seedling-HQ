import { randomUUID } from 'node:crypto';
import type { TenantRepository } from '../ports/tenant-repository.js';
import type { UnitOfWork } from '../ports/unit-of-work.js';
import type { CreateTenantInput, CreateTenantOutput } from '../dto/create-tenant-dto.js';
import { ConflictError, ValidationError, isUniqueViolation } from '../../shared/errors.js';
import { hashPassword } from '../../shared/password.js';

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
    private uow: UnitOfWork,
  ) {}

  async execute(input: CreateTenantInput, correlationId: string): Promise<CreateTenantOutput> {
    const slug = slugify(input.businessName);
    if (!slug) {
      throw new ValidationError('Business name must contain at least one alphanumeric character');
    }

    const existing = await this.tenantRepo.getBySlug(slug);
    if (existing) {
      throw new ConflictError(`Tenant with slug "${slug}" already exists`);
    }

    const tenantId = randomUUID();
    const userId = randomUUID();
    const passwordHash = input.ownerPassword ? await hashPassword(input.ownerPassword) : null;

    try {
      return await this.uow.run(async ({ tenantRepo, userRepo, auditRepo }) => {
        const tenant = await tenantRepo.create({
          id: tenantId,
          slug,
          name: input.businessName,
          status: 'active',
        });

        const user = await userRepo.create({
          id: userId,
          tenantId,
          email: input.ownerEmail,
          fullName: input.ownerFullName,
          role: 'owner',
          passwordHash,
          status: 'active',
        });

        await auditRepo.record({
          id: randomUUID(),
          tenantId,
          principalType: 'internal',
          principalId: userId,
          eventName: 'tenant.created',
          subjectType: 'tenant',
          subjectId: tenantId,
          correlationId,
        });

        await auditRepo.record({
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
      });
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        throw new ConflictError(`Tenant with slug "${slug}" already exists`);
      }
      throw err;
    }
  }
}
