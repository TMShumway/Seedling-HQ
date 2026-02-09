import { randomUUID } from 'node:crypto';
import type { PropertyRepository } from '../ports/property-repository.js';
import type { AuditEventRepository } from '../ports/audit-event-repository.js';
import type { DeactivatePropertyInput } from '../dto/property-dto.js';
import { NotFoundError } from '../../shared/errors.js';

export class DeactivatePropertyUseCase {
  constructor(
    private propertyRepo: PropertyRepository,
    private auditRepo: AuditEventRepository,
  ) {}

  async execute(
    input: DeactivatePropertyInput,
    correlationId: string,
  ): Promise<void> {
    const deactivated = await this.propertyRepo.deactivate(input.tenantId, input.id);
    if (!deactivated) {
      throw new NotFoundError('Property not found');
    }

    await this.auditRepo.record({
      id: randomUUID(),
      tenantId: input.tenantId,
      principalType: 'internal',
      principalId: input.userId,
      eventName: 'property.deactivated',
      subjectType: 'property',
      subjectId: input.id,
      correlationId,
    });
  }
}
