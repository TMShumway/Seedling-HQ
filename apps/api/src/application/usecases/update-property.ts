import { randomUUID } from 'node:crypto';
import type { PropertyRepository } from '../ports/property-repository.js';
import type { AuditEventRepository } from '../ports/audit-event-repository.js';
import type { UpdatePropertyInput, PropertyOutput } from '../dto/property-dto.js';
import { NotFoundError, ConflictError, isUniqueViolation } from '../../shared/errors.js';

export class UpdatePropertyUseCase {
  constructor(
    private propertyRepo: PropertyRepository,
    private auditRepo: AuditEventRepository,
  ) {}

  async execute(
    input: UpdatePropertyInput,
    correlationId: string,
  ): Promise<PropertyOutput> {
    const patch: Record<string, unknown> = {};
    if (input.addressLine1 !== undefined) patch.addressLine1 = input.addressLine1.trim();
    if (input.addressLine2 !== undefined) patch.addressLine2 = input.addressLine2;
    if (input.city !== undefined) patch.city = input.city;
    if (input.state !== undefined) patch.state = input.state;
    if (input.zip !== undefined) patch.zip = input.zip;
    if (input.notes !== undefined) patch.notes = input.notes;

    try {
      const property = await this.propertyRepo.update(input.tenantId, input.id, patch);
      if (!property) {
        throw new NotFoundError('Property not found');
      }

      await this.auditRepo.record({
        id: randomUUID(),
        tenantId: input.tenantId,
        principalType: 'internal',
        principalId: input.userId,
        eventName: 'property.updated',
        subjectType: 'property',
        subjectId: input.id,
        correlationId,
      });

      return { property };
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        throw new ConflictError(`Property at "${input.addressLine1}" already exists for this client`);
      }
      throw err;
    }
  }
}
