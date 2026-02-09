import { randomUUID } from 'node:crypto';
import type { ClientRepository } from '../ports/client-repository.js';
import type { AuditEventRepository } from '../ports/audit-event-repository.js';
import type { UpdateClientInput, ClientOutput } from '../dto/client-dto.js';
import { NotFoundError, ConflictError, isUniqueViolation } from '../../shared/errors.js';

export class UpdateClientUseCase {
  constructor(
    private clientRepo: ClientRepository,
    private auditRepo: AuditEventRepository,
  ) {}

  async execute(
    input: UpdateClientInput,
    correlationId: string,
  ): Promise<ClientOutput> {
    const patch: Record<string, unknown> = {};
    if (input.firstName !== undefined) patch.firstName = input.firstName.trim();
    if (input.lastName !== undefined) patch.lastName = input.lastName.trim();
    if (input.email !== undefined) patch.email = input.email;
    if (input.phone !== undefined) patch.phone = input.phone;
    if (input.company !== undefined) patch.company = input.company;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.tags !== undefined) patch.tags = input.tags;

    try {
      const client = await this.clientRepo.update(input.tenantId, input.id, patch);
      if (!client) {
        throw new NotFoundError('Client not found');
      }

      await this.auditRepo.record({
        id: randomUUID(),
        tenantId: input.tenantId,
        principalType: 'internal',
        principalId: input.userId,
        eventName: 'client.updated',
        subjectType: 'client',
        subjectId: input.id,
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
