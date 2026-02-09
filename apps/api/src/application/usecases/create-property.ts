import { randomUUID } from 'node:crypto';
import type { PropertyRepository } from '../ports/property-repository.js';
import type { ClientRepository } from '../ports/client-repository.js';
import type { AuditEventRepository } from '../ports/audit-event-repository.js';
import type { CreatePropertyInput, PropertyOutput } from '../dto/property-dto.js';
import { ValidationError, NotFoundError, ConflictError, isUniqueViolation } from '../../shared/errors.js';

export class CreatePropertyUseCase {
  constructor(
    private propertyRepo: PropertyRepository,
    private clientRepo: ClientRepository,
    private auditRepo: AuditEventRepository,
  ) {}

  async execute(
    input: CreatePropertyInput,
    correlationId: string,
  ): Promise<PropertyOutput> {
    if (!input.addressLine1.trim()) {
      throw new ValidationError('Address line 1 is required');
    }

    const client = await this.clientRepo.getById(input.tenantId, input.clientId);
    if (!client) {
      throw new NotFoundError('Client not found');
    }

    const id = randomUUID();

    try {
      const property = await this.propertyRepo.create({
        id,
        tenantId: input.tenantId,
        clientId: input.clientId,
        addressLine1: input.addressLine1.trim(),
        addressLine2: input.addressLine2,
        city: input.city,
        state: input.state,
        zip: input.zip,
        notes: input.notes,
        active: true,
      });

      await this.auditRepo.record({
        id: randomUUID(),
        tenantId: input.tenantId,
        principalType: 'internal',
        principalId: input.userId,
        eventName: 'property.created',
        subjectType: 'property',
        subjectId: id,
        correlationId,
      });

      return { property };
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        throw new ConflictError(`Property at "${input.addressLine1.trim()}" already exists for this client`);
      }
      throw err;
    }
  }
}
