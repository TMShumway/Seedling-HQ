import { randomUUID } from 'node:crypto';
import type { ServiceItemRepository } from '../ports/service-item-repository.js';
import type { ServiceCategoryRepository } from '../ports/service-category-repository.js';
import type { AuditEventRepository } from '../ports/audit-event-repository.js';
import type { CreateServiceItemInput, ServiceItemOutput } from '../dto/service-item-dto.js';
import { ValidationError, NotFoundError, ConflictError, isUniqueViolation } from '../../shared/errors.js';

export class CreateServiceItemUseCase {
  constructor(
    private itemRepo: ServiceItemRepository,
    private categoryRepo: ServiceCategoryRepository,
    private auditRepo: AuditEventRepository,
  ) {}

  async execute(
    input: CreateServiceItemInput,
    correlationId: string,
  ): Promise<ServiceItemOutput> {
    if (!input.name.trim()) {
      throw new ValidationError('Service name is required');
    }
    if (input.unitPrice < 0) {
      throw new ValidationError('Unit price must be non-negative');
    }

    const category = await this.categoryRepo.getById(input.tenantId, input.categoryId);
    if (!category) {
      throw new NotFoundError('Service category not found');
    }

    const id = randomUUID();

    try {
      const item = await this.itemRepo.create({
        id,
        tenantId: input.tenantId,
        categoryId: input.categoryId,
        name: input.name.trim(),
        description: input.description,
        unitPrice: input.unitPrice,
        unitType: input.unitType,
        estimatedDurationMinutes: input.estimatedDurationMinutes,
        active: true,
        sortOrder: input.sortOrder ?? 0,
      });

      await this.auditRepo.record({
        id: randomUUID(),
        tenantId: input.tenantId,
        principalType: 'internal',
        principalId: input.userId,
        eventName: 'service_item.created',
        subjectType: 'service_item',
        subjectId: id,
        correlationId,
      });

      return { item };
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        throw new ConflictError(`Service "${input.name.trim()}" already exists in this category`);
      }
      throw err;
    }
  }
}
