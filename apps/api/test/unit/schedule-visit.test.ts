import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScheduleVisitUseCase } from '../../src/application/usecases/schedule-visit.js';
import type { VisitRepository } from '../../src/application/ports/visit-repository.js';
import type { AuditEventRepository } from '../../src/application/ports/audit-event-repository.js';
import type { Visit } from '../../src/domain/entities/visit.js';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000010';
const VISIT_ID = '00000000-0000-0000-0000-000000000950';
const JOB_ID = '00000000-0000-0000-0000-000000000900';

function makeVisit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: VISIT_ID,
    tenantId: TENANT_ID,
    jobId: JOB_ID,
    assignedUserId: null,
    scheduledStart: null,
    scheduledEnd: null,
    estimatedDurationMinutes: 60,
    status: 'scheduled',
    notes: null,
    completedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('ScheduleVisitUseCase', () => {
  let visitRepo: VisitRepository;
  let auditRepo: AuditEventRepository;
  let useCase: ScheduleVisitUseCase;

  beforeEach(() => {
    visitRepo = {
      create: vi.fn(),
      getById: vi.fn(),
      listByJobId: vi.fn(),
      updateSchedule: vi.fn(),
      updateAssignedUser: vi.fn(),
      updateStatus: vi.fn(),
      updateNotes: vi.fn(),
      listByDateRange: vi.fn(),
      listUnscheduled: vi.fn(),
    };

    auditRepo = {
      record: vi.fn(),
      listBySubjects: vi.fn(),
    };

    useCase = new ScheduleVisitUseCase(visitRepo, auditRepo);
  });

  it('schedules a visit for the first time and emits visit.time_set', async () => {
    const visit = makeVisit();
    const start = new Date('2026-02-15T09:00:00Z');
    const expectedEnd = new Date('2026-02-15T10:00:00Z'); // +60 min

    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
    (visitRepo.updateSchedule as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...visit,
      scheduledStart: start,
      scheduledEnd: expectedEnd,
      updatedAt: new Date(),
    });

    const result = await useCase.execute(
      { tenantId: TENANT_ID, userId: USER_ID, visitId: VISIT_ID, scheduledStart: start },
      'corr-1',
    );

    expect(result.visit.scheduledStart).toEqual(start);
    expect(result.visit.scheduledEnd).toEqual(expectedEnd);

    // Verify updateSchedule called with auto-computed end
    expect(visitRepo.updateSchedule).toHaveBeenCalledWith(TENANT_ID, VISIT_ID, start, expectedEnd);

    // Verify audit event
    const auditCall = (auditRepo.record as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(auditCall.eventName).toBe('visit.time_set');
    expect(auditCall.subjectType).toBe('visit');
    expect(auditCall.subjectId).toBe(VISIT_ID);
    expect(auditCall.metadata).toEqual({
      newStart: start.toISOString(),
      newEnd: expectedEnd.toISOString(),
    });
  });

  it('reschedules a visit and emits visit.rescheduled with previous times', async () => {
    const prevStart = new Date('2026-02-14T08:00:00Z');
    const prevEnd = new Date('2026-02-14T09:00:00Z');
    const visit = makeVisit({ scheduledStart: prevStart, scheduledEnd: prevEnd });
    const newStart = new Date('2026-02-15T10:00:00Z');
    const newEnd = new Date('2026-02-15T11:00:00Z');

    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
    (visitRepo.updateSchedule as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...visit,
      scheduledStart: newStart,
      scheduledEnd: newEnd,
      updatedAt: new Date(),
    });

    const result = await useCase.execute(
      { tenantId: TENANT_ID, userId: USER_ID, visitId: VISIT_ID, scheduledStart: newStart },
      'corr-2',
    );

    expect(result.visit.scheduledStart).toEqual(newStart);

    const auditCall = (auditRepo.record as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(auditCall.eventName).toBe('visit.rescheduled');
    expect(auditCall.metadata).toEqual({
      previousStart: prevStart.toISOString(),
      previousEnd: prevEnd.toISOString(),
      newStart: newStart.toISOString(),
      newEnd: newEnd.toISOString(),
    });
  });

  it('uses provided scheduledEnd instead of auto-computing', async () => {
    const visit = makeVisit();
    const start = new Date('2026-02-15T09:00:00Z');
    const customEnd = new Date('2026-02-15T12:00:00Z'); // 3 hours, not 60 min

    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
    (visitRepo.updateSchedule as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...visit,
      scheduledStart: start,
      scheduledEnd: customEnd,
      updatedAt: new Date(),
    });

    const result = await useCase.execute(
      { tenantId: TENANT_ID, userId: USER_ID, visitId: VISIT_ID, scheduledStart: start, scheduledEnd: customEnd },
      'corr-3',
    );

    expect(visitRepo.updateSchedule).toHaveBeenCalledWith(TENANT_ID, VISIT_ID, start, customEnd);
    expect(result.visit.scheduledEnd).toEqual(customEnd);
  });

  it('auto-computes end from estimatedDurationMinutes', async () => {
    const visit = makeVisit({ estimatedDurationMinutes: 90 });
    const start = new Date('2026-02-15T09:00:00Z');
    const expectedEnd = new Date('2026-02-15T10:30:00Z'); // +90 min

    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
    (visitRepo.updateSchedule as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...visit,
      scheduledStart: start,
      scheduledEnd: expectedEnd,
      updatedAt: new Date(),
    });

    await useCase.execute(
      { tenantId: TENANT_ID, userId: USER_ID, visitId: VISIT_ID, scheduledStart: start },
      'corr-4',
    );

    expect(visitRepo.updateSchedule).toHaveBeenCalledWith(TENANT_ID, VISIT_ID, start, expectedEnd);
  });

  it('throws NotFoundError when visit does not exist', async () => {
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      useCase.execute(
        { tenantId: TENANT_ID, userId: USER_ID, visitId: VISIT_ID, scheduledStart: new Date() },
        'corr-5',
      ),
    ).rejects.toThrow('Visit not found');
  });

  it('throws ValidationError when visit status is not scheduled', async () => {
    const visit = makeVisit({ status: 'completed' });
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);

    await expect(
      useCase.execute(
        { tenantId: TENANT_ID, userId: USER_ID, visitId: VISIT_ID, scheduledStart: new Date() },
        'corr-6',
      ),
    ).rejects.toThrow('Only visits with status "scheduled" can be scheduled');
  });

  it('throws ValidationError when end is before start', async () => {
    const visit = makeVisit();
    const start = new Date('2026-02-15T10:00:00Z');
    const end = new Date('2026-02-15T09:00:00Z'); // before start

    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);

    await expect(
      useCase.execute(
        { tenantId: TENANT_ID, userId: USER_ID, visitId: VISIT_ID, scheduledStart: start, scheduledEnd: end },
        'corr-7',
      ),
    ).rejects.toThrow('End time must be after start time');
  });

  it('throws ValidationError when end equals start', async () => {
    const visit = makeVisit();
    const start = new Date('2026-02-15T10:00:00Z');

    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);

    await expect(
      useCase.execute(
        { tenantId: TENANT_ID, userId: USER_ID, visitId: VISIT_ID, scheduledStart: start, scheduledEnd: start },
        'corr-8',
      ),
    ).rejects.toThrow('End time must be after start time');
  });

  it('throws ConflictError when updateSchedule returns null (concurrent status change)', async () => {
    const visit = makeVisit();
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
    (visitRepo.updateSchedule as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      useCase.execute(
        { tenantId: TENANT_ID, userId: USER_ID, visitId: VISIT_ID, scheduledStart: new Date('2026-02-15T09:00:00Z') },
        'corr-9',
      ),
    ).rejects.toThrow('Visit was modified concurrently');
  });

  it('does not propagate audit failure', async () => {
    const visit = makeVisit();
    const start = new Date('2026-02-15T09:00:00Z');
    const expectedEnd = new Date('2026-02-15T10:00:00Z');

    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
    (visitRepo.updateSchedule as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...visit,
      scheduledStart: start,
      scheduledEnd: expectedEnd,
      updatedAt: new Date(),
    });
    (auditRepo.record as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Audit DB down'));

    // Should NOT throw
    const result = await useCase.execute(
      { tenantId: TENANT_ID, userId: USER_ID, visitId: VISIT_ID, scheduledStart: start },
      'corr-10',
    );

    expect(result.visit.scheduledStart).toEqual(start);
  });

  it('handles reschedule where previous end was null', async () => {
    // Edge case: visit was previously scheduled with start but no end
    const prevStart = new Date('2026-02-14T08:00:00Z');
    const visit = makeVisit({ scheduledStart: prevStart, scheduledEnd: null });
    const newStart = new Date('2026-02-15T10:00:00Z');
    const newEnd = new Date('2026-02-15T11:00:00Z');

    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
    (visitRepo.updateSchedule as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...visit,
      scheduledStart: newStart,
      scheduledEnd: newEnd,
      updatedAt: new Date(),
    });

    await useCase.execute(
      { tenantId: TENANT_ID, userId: USER_ID, visitId: VISIT_ID, scheduledStart: newStart },
      'corr-11',
    );

    const auditCall = (auditRepo.record as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(auditCall.eventName).toBe('visit.rescheduled');
    expect(auditCall.metadata.previousStart).toBe(prevStart.toISOString());
    expect(auditCall.metadata.previousEnd).toBeNull();
  });
});
