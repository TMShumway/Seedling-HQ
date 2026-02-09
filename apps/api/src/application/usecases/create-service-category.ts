import { randomUUID } from 'node:crypto';
import type { ServiceCategoryRepository } from '../ports/service-category-repository.js';
import type { AuditEventRepository } from '../ports/audit-event-repository.js';
import type { CreateServiceCategoryInput, ServiceCategoryOutput } from '../dto/service-category-dto.js';
import { ValidationError, ConflictError, isUniqueViolation } from '../../shared/errors.js';

export class CreateServiceCategoryUseCase {
  constructor(
    private categoryRepo: ServiceCategoryRepository,
    private auditRepo: AuditEventRepository,
  ) {}

  async execute(
    input: CreateServiceCategoryInput,
    correlationId: string,
  ): Promise<ServiceCategoryOutput> {
    if (!input.name.trim()) {
      throw new ValidationError('Category name is required');
    }

    const id = randomUUID();

    try {
      const category = await this.categoryRepo.create({
        id,
        tenantId: input.tenantId,
        name: input.name.trim(),
        description: input.description,
        sortOrder: input.sortOrder ?? 0,
        active: true,
      });

      await this.auditRepo.record({
        id: randomUUID(),
        tenantId: input.tenantId,
        principalType: 'internal',
        principalId: input.userId,
        eventName: 'service_category.created',
        subjectType: 'service_category',
        subjectId: id,
        correlationId,
      });

      return { category };
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        throw new ConflictError(`Category "${input.name.trim()}" already exists`);
      }
      throw err;
    }
  }
}
