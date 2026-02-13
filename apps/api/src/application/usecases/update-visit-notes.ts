import { randomUUID } from 'node:crypto';
import type { VisitRepository } from '../ports/visit-repository.js';
import type { AuditEventRepository } from '../ports/audit-event-repository.js';
import type { UpdateVisitNotesInput, UpdateVisitNotesOutput } from '../dto/update-visit-notes-dto.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../../shared/errors.js';

const EDITABLE_STATUSES = ['en_route', 'started', 'completed'];

export class UpdateVisitNotesUseCase {
  constructor(
    private visitRepo: VisitRepository,
    private auditRepo: AuditEventRepository,
  ) {}

  async execute(input: UpdateVisitNotesInput, correlationId: string): Promise<UpdateVisitNotesOutput> {
    const visit = await this.visitRepo.getById(input.tenantId, input.visitId);
    if (!visit) {
      throw new NotFoundError('Visit not found');
    }

    if (!EDITABLE_STATUSES.includes(visit.status)) {
      throw new ValidationError(`Cannot update notes on a visit with status "${visit.status}"`);
    }

    // RBAC: owner/admin can update any visit; member can only update their own assigned visit
    if (input.callerRole === 'member' && visit.assignedUserId !== input.callerUserId) {
      throw new ForbiddenError('Members can only update notes on their own assigned visits');
    }

    const updated = await this.visitRepo.updateNotes(input.tenantId, input.visitId, input.notes);
    if (!updated) {
      throw new NotFoundError('Visit not found');
    }

    // Best-effort audit
    try {
      await this.auditRepo.record({
        id: randomUUID(),
        tenantId: input.tenantId,
        principalType: 'internal',
        principalId: input.callerUserId,
        eventName: 'visit.notes_updated',
        subjectType: 'visit',
        subjectId: input.visitId,
        correlationId,
        metadata: { notesLength: input.notes?.length ?? 0 },
      });
    } catch {
      // Best-effort
    }

    return { visit: updated };
  }
}
