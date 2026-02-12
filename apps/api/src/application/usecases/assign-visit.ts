import { randomUUID } from 'node:crypto';
import type { VisitRepository } from '../ports/visit-repository.js';
import type { UserRepository } from '../ports/user-repository.js';
import type { AuditEventRepository } from '../ports/audit-event-repository.js';
import type { AssignVisitInput, AssignVisitOutput } from '../dto/assign-visit-dto.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../../shared/errors.js';

export class AssignVisitUseCase {
  constructor(
    private visitRepo: VisitRepository,
    private userRepo: UserRepository,
    private auditRepo: AuditEventRepository,
  ) {}

  async execute(
    input: AssignVisitInput,
    correlationId: string,
  ): Promise<AssignVisitOutput> {
    // Role guard: only owner or admin can assign
    if (input.callerRole !== 'owner' && input.callerRole !== 'admin') {
      throw new ForbiddenError('Only owners and admins can assign technicians');
    }

    // Fetch existing visit
    const existing = await this.visitRepo.getById(input.tenantId, input.visitId);
    if (!existing) {
      throw new NotFoundError('Visit not found');
    }

    // Validate target user if assigning (not unassigning)
    let assignedUserName: string | null = null;
    if (input.assignedUserId !== null) {
      const targetUser = await this.userRepo.getById(input.tenantId, input.assignedUserId);
      if (!targetUser) {
        throw new NotFoundError('User not found');
      }
      if (targetUser.status !== 'active') {
        throw new ValidationError('Cannot assign to an inactive user');
      }
      assignedUserName = targetUser.fullName;
    }

    // No-op if assignment hasn't changed
    const previousUserId = existing.assignedUserId;
    if (previousUserId === input.assignedUserId) {
      return { visit: existing };
    }

    // Update assignment
    const updated = await this.visitRepo.updateAssignedUser(
      input.tenantId,
      input.visitId,
      input.assignedUserId,
    );

    if (!updated) {
      throw new NotFoundError('Visit not found');
    }

    // Best-effort audit
    try {
      let eventName: string;
      const metadata: Record<string, unknown> = {};

      if (input.assignedUserId !== null && previousUserId === null) {
        // Assign (first time)
        eventName = 'visit.assigned';
        metadata.assignedUserId = input.assignedUserId;
        metadata.assignedUserName = assignedUserName;
      } else if (input.assignedUserId !== null && previousUserId !== null) {
        // Reassign
        eventName = 'visit.assigned';
        metadata.assignedUserId = input.assignedUserId;
        metadata.assignedUserName = assignedUserName;
        metadata.previousUserId = previousUserId;
        // Look up previous user name
        const previousUser = await this.userRepo.getById(input.tenantId, previousUserId);
        metadata.previousUserName = previousUser?.fullName ?? null;
      } else {
        // Unassign
        eventName = 'visit.unassigned';
        metadata.previousUserId = previousUserId;
        const previousUser = await this.userRepo.getById(input.tenantId, previousUserId!);
        metadata.previousUserName = previousUser?.fullName ?? null;
      }

      await this.auditRepo.record({
        id: randomUUID(),
        tenantId: input.tenantId,
        principalType: 'internal',
        principalId: input.callerUserId,
        eventName,
        subjectType: 'visit',
        subjectId: input.visitId,
        correlationId,
        metadata,
      });
    } catch {
      // Best-effort — audit failure must not propagate
    }

    return { visit: updated };
  }
}
