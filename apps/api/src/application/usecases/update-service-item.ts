import { randomUUID } from 'node:crypto';
import type { ServiceItemRepository } from '../ports/service-item-repository.js';
import type { AuditEventRepository } from '../ports/audit-event-repository.js';
import type { UpdateServiceItemInput, ServiceItemOutput } from '../dto/service-item-dto.js';
import { NotFoundError, ConflictError, isUniqueViolation } from '../../shared/errors.js';

export class UpdateServiceItemUseCase {
  constructor(
    private itemRepo: ServiceItemRepository,
    private auditRepo: AuditEventRepository,
  ) {}

  async execute(
    input: UpdateServiceItemInput,
    correlationId: string,
  ): Promise<ServiceItemOutput> {
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.description !== undefined) patch.description = input.description;
    if (input.unitPrice !== undefined) patch.unitPrice = input.unitPrice;
    if (input.unitType !== undefined) patch.unitType = input.unitType;
    if (input.estimatedDurationMinutes !== undefined) patch.estimatedDurationMinutes = input.estimatedDurationMinutes;
    if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;

    try {
      const item = await this.itemRepo.update(input.tenantId, input.id, patch);
      if (!item) {
        throw new NotFoundError('Service item not found');
      }

      await this.auditRepo.record({
        id: randomUUID(),
        tenantId: input.tenantId,
        principalType: 'internal',
        principalId: input.userId,
        eventName: 'service_item.updated',
        subjectType: 'service_item',
        subjectId: input.id,
        correlationId,
      });

      return { item };
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        throw new ConflictError(`Service "${input.name}" already exists in this category`);
      }
      throw err;
    }
  }
}
