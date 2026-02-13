import { randomUUID } from 'node:crypto';
import type { VisitRepository } from '../ports/visit-repository.js';
import type { JobRepository } from '../ports/job-repository.js';
import type { AuditEventRepository } from '../ports/audit-event-repository.js';
import type { TransitionVisitStatusInput, TransitionVisitStatusOutput } from '../dto/transition-visit-status-dto.js';
import type { VisitStatus } from '../../domain/types/visit-status.js';
import { NotFoundError, ValidationError, ForbiddenError, ConflictError } from '../../shared/errors.js';

const VALID_TRANSITIONS: Record<VisitStatus, VisitStatus[]> = {
  scheduled: ['en_route', 'started', 'cancelled'],
  en_route: ['started', 'cancelled'],
  started: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function getValidTransitions(currentStatus: VisitStatus): VisitStatus[] {
  return VALID_TRANSITIONS[currentStatus] ?? [];
}

export function isValidTransition(from: VisitStatus, to: VisitStatus): boolean {
  return getValidTransitions(from).includes(to);
}

const TERMINAL_STATUSES: VisitStatus[] = ['completed', 'cancelled'];

export class TransitionVisitStatusUseCase {
  constructor(
    private visitRepo: VisitRepository,
    private jobRepo: JobRepository,
    private auditRepo: AuditEventRepository,
  ) {}

  async execute(
    input: TransitionVisitStatusInput,
    correlationId: string,
  ): Promise<TransitionVisitStatusOutput> {
    // 1. Fetch existing visit
    const existing = await this.visitRepo.getById(input.tenantId, input.visitId);
    if (!existing) {
      throw new NotFoundError('Visit not found');
    }

    // 2. Validate transition
    if (!isValidTransition(existing.status, input.newStatus)) {
      const valid = getValidTransitions(existing.status);
      const validStr = valid.length > 0 ? valid.join(', ') : 'none (terminal status)';
      throw new ValidationError(
        `Cannot transition from '${existing.status}' to '${input.newStatus}'. Valid transitions: ${validStr}`,
      );
    }

    // 3. RBAC
    if (input.newStatus === 'cancelled') {
      // Only owner/admin can cancel
      if (input.callerRole !== 'owner' && input.callerRole !== 'admin') {
        throw new ForbiddenError('Only owners and admins can cancel visits');
      }
    } else {
      // Owner/admin can transition any visit; member only their own assigned
      if (input.callerRole !== 'owner' && input.callerRole !== 'admin') {
        if (existing.assignedUserId !== input.callerUserId) {
          throw new ForbiddenError('You can only transition your own assigned visits');
        }
      }
    }

    // 4. Update status (race-safe)
    const updated = await this.visitRepo.updateStatus(
      input.tenantId,
      input.visitId,
      input.newStatus,
      [existing.status],
    );
    if (!updated) {
      throw new ConflictError('Visit status was changed concurrently. Please retry.');
    }

    // 5. Best-effort audit
    try {
      await this.auditRepo.record({
        id: randomUUID(),
        tenantId: input.tenantId,
        principalType: 'internal',
        principalId: input.callerUserId,
        eventName: `visit.${input.newStatus}`,
        subjectType: 'visit',
        subjectId: input.visitId,
        correlationId,
        metadata: { previousStatus: existing.status },
      });
    } catch {
      // Best-effort — audit failure must not propagate
    }

    // 6. Best-effort job auto-derivation
    try {
      await this.deriveJobStatus(input, existing.status, existing.jobId, correlationId);
    } catch {
      // Best-effort — job derivation failure must not propagate
    }

    return { visit: updated };
  }

  private async deriveJobStatus(
    input: TransitionVisitStatusInput,
    previousVisitStatus: VisitStatus,
    jobId: string,
    correlationId: string,
  ): Promise<void> {
    if (input.newStatus === 'started') {
      // If visit started and job is still scheduled, move job to in_progress
      const job = await this.jobRepo.getById(input.tenantId, jobId);
      if (job && job.status === 'scheduled') {
        const updatedJob = await this.jobRepo.updateStatus(input.tenantId, jobId, 'in_progress');
        if (updatedJob) {
          await this.auditRepo.record({
            id: randomUUID(),
            tenantId: input.tenantId,
            principalType: 'internal',
            principalId: input.callerUserId,
            eventName: 'job.in_progress',
            subjectType: 'job',
            subjectId: jobId,
            correlationId,
            metadata: { previousStatus: 'scheduled' },
          });
        }
      }
    } else if (input.newStatus === 'completed' || input.newStatus === 'cancelled') {
      // Check if all visits are terminal
      const allVisits = await this.visitRepo.listByJobId(input.tenantId, jobId);
      const allTerminal = allVisits.every((v) => TERMINAL_STATUSES.includes(v.status));

      if (allTerminal) {
        const allCancelled = allVisits.every((v) => v.status === 'cancelled');
        const job = await this.jobRepo.getById(input.tenantId, jobId);
        if (!job) return;

        if (allCancelled) {
          // All cancelled → job cancelled
          const updatedJob = await this.jobRepo.updateStatus(input.tenantId, jobId, 'cancelled');
          if (updatedJob) {
            await this.auditRepo.record({
              id: randomUUID(),
              tenantId: input.tenantId,
              principalType: 'internal',
              principalId: input.callerUserId,
              eventName: 'job.cancelled',
              subjectType: 'job',
              subjectId: jobId,
              correlationId,
              metadata: { previousStatus: job.status },
            });
          }
        } else {
          // Mix of completed + cancelled (≥1 completed) → job completed
          const updatedJob = await this.jobRepo.updateStatus(input.tenantId, jobId, 'completed');
          if (updatedJob) {
            await this.auditRepo.record({
              id: randomUUID(),
              tenantId: input.tenantId,
              principalType: 'internal',
              principalId: input.callerUserId,
              eventName: 'job.completed',
              subjectType: 'job',
              subjectId: jobId,
              correlationId,
              metadata: { previousStatus: job.status },
            });
          }
        }
      }
    }
  }
}
