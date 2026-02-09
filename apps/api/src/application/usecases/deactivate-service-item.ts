import { randomUUID } from 'node:crypto';
import type { ServiceItemRepository } from '../ports/service-item-repository.js';
import type { AuditEventRepository } from '../ports/audit-event-repository.js';
import type { DeactivateServiceItemInput } from '../dto/service-item-dto.js';
import { NotFoundError } from '../../shared/errors.js';

export class DeactivateServiceItemUseCase {
  constructor(
    private itemRepo: ServiceItemRepository,
    private auditRepo: AuditEventRepository,
  ) {}

  async execute(
    input: DeactivateServiceItemInput,
    correlationId: string,
  ): Promise<void> {
    const deactivated = await this.itemRepo.deactivate(input.tenantId, input.id);
    if (!deactivated) {
      throw new NotFoundError('Service item not found');
    }

    await this.auditRepo.record({
      id: randomUUID(),
      tenantId: input.tenantId,
      principalType: 'internal',
      principalId: input.userId,
      eventName: 'service_item.deactivated',
      subjectType: 'service_item',
      subjectId: input.id,
      correlationId,
    });
  }
}
