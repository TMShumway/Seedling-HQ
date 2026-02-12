import { randomUUID } from 'node:crypto';
import type { VisitRepository } from '../ports/visit-repository.js';
import type { AuditEventRepository } from '../ports/audit-event-repository.js';
import type { ScheduleVisitInput, ScheduleVisitOutput } from '../dto/schedule-visit-dto.js';
import { NotFoundError, ValidationError, ConflictError } from '../../shared/errors.js';

export class ScheduleVisitUseCase {
  constructor(
    private visitRepo: VisitRepository,
    private auditRepo: AuditEventRepository,
  ) {}

  async execute(
    input: ScheduleVisitInput,
    correlationId: string,
  ): Promise<ScheduleVisitOutput> {
    const existing = await this.visitRepo.getById(input.tenantId, input.visitId);
    if (!existing) {
      throw new NotFoundError('Visit not found');
    }

    if (existing.status !== 'scheduled') {
      throw new ValidationError('Only visits with status "scheduled" can be scheduled');
    }

    if (isNaN(input.scheduledStart.getTime())) {
      throw new ValidationError('Invalid start time');
    }

    // Compute end time: use provided end or add estimatedDurationMinutes to start
    const scheduledEnd = input.scheduledEnd
      ?? new Date(input.scheduledStart.getTime() + existing.estimatedDurationMinutes * 60 * 1000);

    if (scheduledEnd <= input.scheduledStart) {
      throw new ValidationError('End time must be after start time');
    }

    // Capture previous times for audit metadata
    const previousStart = existing.scheduledStart;
    const previousEnd = existing.scheduledEnd;

    // Status-guarded update — returns null if status changed concurrently
    const updated = await this.visitRepo.updateSchedule(
      input.tenantId,
      input.visitId,
      input.scheduledStart,
      scheduledEnd,
    );

    if (!updated) {
      throw new ConflictError('Visit was modified concurrently — please retry');
    }

    // Best-effort audit
    try {
      const isFirstSchedule = previousStart === null;
      const eventName = isFirstSchedule ? 'visit.time_set' : 'visit.rescheduled';
      const metadata: Record<string, unknown> = {
        newStart: input.scheduledStart.toISOString(),
        newEnd: scheduledEnd.toISOString(),
      };
      if (!isFirstSchedule) {
        metadata.previousStart = previousStart!.toISOString();
        metadata.previousEnd = previousEnd?.toISOString() ?? null;
      }

      await this.auditRepo.record({
        id: randomUUID(),
        tenantId: input.tenantId,
        principalType: 'internal',
        principalId: input.userId,
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
