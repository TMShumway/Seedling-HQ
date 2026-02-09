import { randomUUID } from 'node:crypto';
import type { ServiceCategoryRepository } from '../ports/service-category-repository.js';
import type { AuditEventRepository } from '../ports/audit-event-repository.js';
import type { UpdateServiceCategoryInput, ServiceCategoryOutput } from '../dto/service-category-dto.js';
import { NotFoundError, ConflictError, isUniqueViolation } from '../../shared/errors.js';

export class UpdateServiceCategoryUseCase {
  constructor(
    private categoryRepo: ServiceCategoryRepository,
    private auditRepo: AuditEventRepository,
  ) {}

  async execute(
    input: UpdateServiceCategoryInput,
    correlationId: string,
  ): Promise<ServiceCategoryOutput> {
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.description !== undefined) patch.description = input.description;
    if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;

    try {
      const category = await this.categoryRepo.update(input.tenantId, input.id, patch);
      if (!category) {
        throw new NotFoundError('Service category not found');
      }

      await this.auditRepo.record({
        id: randomUUID(),
        tenantId: input.tenantId,
        principalType: 'internal',
        principalId: input.userId,
        eventName: 'service_category.updated',
        subjectType: 'service_category',
        subjectId: input.id,
        correlationId,
      });

      return { category };
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        throw new ConflictError(`Category "${input.name}" already exists`);
      }
      throw err;
    }
  }
}
