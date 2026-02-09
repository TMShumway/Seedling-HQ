import { randomUUID } from 'node:crypto';
import type { ClientRepository } from '../ports/client-repository.js';
import type { AuditEventRepository } from '../ports/audit-event-repository.js';
import type { CreateClientInput, ClientOutput } from '../dto/client-dto.js';
import { ValidationError, ConflictError, isUniqueViolation } from '../../shared/errors.js';

export class CreateClientUseCase {
  constructor(
    private clientRepo: ClientRepository,
    private auditRepo: AuditEventRepository,
  ) {}

  async execute(
    input: CreateClientInput,
    correlationId: string,
  ): Promise<ClientOutput> {
    if (!input.firstName.trim()) {
      throw new ValidationError('First name is required');
    }
    if (!input.lastName.trim()) {
      throw new ValidationError('Last name is required');
    }

    const id = randomUUID();

    try {
      const client = await this.clientRepo.create({
        id,
        tenantId: input.tenantId,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email: input.email,
        phone: input.phone,
        company: input.company,
        notes: input.notes,
        tags: input.tags,
        active: true,
      });

      await this.auditRepo.record({
        id: randomUUID(),
        tenantId: input.tenantId,
        principalType: 'internal',
        principalId: input.userId,
        eventName: 'client.created',
        subjectType: 'client',
        subjectId: id,
        correlationId,
      });

      return { client };
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        throw new ConflictError(`Client with email "${input.email}" already exists`);
      }
      throw err;
    }
  }
}
