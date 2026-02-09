import { randomUUID } from 'node:crypto';
import type { ServiceCategoryRepository } from '../ports/service-category-repository.js';
import type { AuditEventRepository } from '../ports/audit-event-repository.js';
import type { DeactivateServiceCategoryInput } from '../dto/service-category-dto.js';
import { NotFoundError } from '../../shared/errors.js';

export class DeactivateServiceCategoryUseCase {
  constructor(
    private categoryRepo: ServiceCategoryRepository,
    private auditRepo: AuditEventRepository,
  ) {}

  async execute(
    input: DeactivateServiceCategoryInput,
    correlationId: string,
  ): Promise<void> {
    const deactivated = await this.categoryRepo.deactivate(input.tenantId, input.id);
    if (!deactivated) {
      throw new NotFoundError('Service category not found');
    }

    await this.auditRepo.record({
      id: randomUUID(),
      tenantId: input.tenantId,
      principalType: 'internal',
      principalId: input.userId,
      eventName: 'service_category.deactivated',
      subjectType: 'service_category',
      subjectId: input.id,
      correlationId,
    });
  }
}
