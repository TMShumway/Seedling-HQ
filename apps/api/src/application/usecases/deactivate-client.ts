import { randomUUID } from 'node:crypto';
import type { ClientRepository } from '../ports/client-repository.js';
import type { PropertyRepository } from '../ports/property-repository.js';
import type { AuditEventRepository } from '../ports/audit-event-repository.js';
import type { DeactivateClientInput } from '../dto/client-dto.js';
import { NotFoundError } from '../../shared/errors.js';

export class DeactivateClientUseCase {
  constructor(
    private clientRepo: ClientRepository,
    private propertyRepo: PropertyRepository,
    private auditRepo: AuditEventRepository,
  ) {}

  async execute(
    input: DeactivateClientInput,
    correlationId: string,
  ): Promise<void> {
    const deactivated = await this.clientRepo.deactivate(input.tenantId, input.id);
    if (!deactivated) {
      throw new NotFoundError('Client not found');
    }

    await this.propertyRepo.deactivateByClientId(input.tenantId, input.id);

    await this.auditRepo.record({
      id: randomUUID(),
      tenantId: input.tenantId,
      principalType: 'internal',
      principalId: input.userId,
      eventName: 'client.deactivated',
      subjectType: 'client',
      subjectId: input.id,
      correlationId,
    });
  }
}
