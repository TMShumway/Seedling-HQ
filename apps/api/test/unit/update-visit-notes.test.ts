import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateVisitNotesUseCase } from '../../src/application/usecases/update-visit-notes.js';
import type { VisitRepository } from '../../src/application/ports/visit-repository.js';
import type { AuditEventRepository } from '../../src/application/ports/audit-event-repository.js';
import type { Visit } from '../../src/domain/entities/visit.js';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const CALLER_ID = '00000000-0000-0000-0000-000000000010';
const VISIT_ID = '00000000-0000-0000-0000-000000000950';
const JOB_ID = '00000000-0000-0000-0000-000000000900';

function makeVisit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: VISIT_ID,
    tenantId: TENANT_ID,
    jobId: JOB_ID,
    assignedUserId: CALLER_ID,
    scheduledStart: new Date('2026-02-12T09:00:00'),
    scheduledEnd: new Date('2026-02-12T11:00:00'),
    estimatedDurationMinutes: 120,
    status: 'started',
    notes: null,
    completedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('UpdateVisitNotesUseCase', () => {
  let visitRepo: VisitRepository;
  let auditRepo: AuditEventRepository;
  let useCase: UpdateVisitNotesUseCase;

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
    auditRepo = { record: vi.fn(), listBySubjects: vi.fn() };
    useCase = new UpdateVisitNotesUseCase(visitRepo, auditRepo);
  });

  it('updates notes on a started visit', async () => {
    const visit = makeVisit({ status: 'started' });
    const updated = { ...visit, notes: 'Lawn looks good', updatedAt: new Date() };
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
    (visitRepo.updateNotes as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

    const result = await useCase.execute(
      { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, notes: 'Lawn looks good' },
      'corr-1',
    );

    expect(result.visit.notes).toBe('Lawn looks good');
    expect(visitRepo.updateNotes).toHaveBeenCalledWith(TENANT_ID, VISIT_ID, 'Lawn looks good');
    expect(auditRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'visit.notes_updated', metadata: { notesLength: 15 } }),
    );
  });

  it('allows notes on en_route status', async () => {
    const visit = makeVisit({ status: 'en_route' });
    const updated = { ...visit, notes: 'On my way' };
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
    (visitRepo.updateNotes as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

    const result = await useCase.execute(
      { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, notes: 'On my way' },
      'corr-2',
    );

    expect(result.visit.notes).toBe('On my way');
  });

  it('allows notes on completed status', async () => {
    const visit = makeVisit({ status: 'completed' });
    const updated = { ...visit, notes: 'All done' };
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
    (visitRepo.updateNotes as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

    const result = await useCase.execute(
      { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, notes: 'All done' },
      'corr-3',
    );

    expect(result.visit.notes).toBe('All done');
  });

  it('allows clearing notes with null', async () => {
    const visit = makeVisit({ status: 'started', notes: 'Old notes' });
    const updated = { ...visit, notes: null };
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
    (visitRepo.updateNotes as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

    const result = await useCase.execute(
      { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, notes: null },
      'corr-4',
    );

    expect(result.visit.notes).toBeNull();
    expect(auditRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { notesLength: 0 } }),
    );
  });

  it('rejects notes on scheduled visits', async () => {
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeVisit({ status: 'scheduled' }));

    await expect(
      useCase.execute(
        { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, notes: 'test' },
        'corr-5',
      ),
    ).rejects.toThrow('Cannot update notes on a visit with status "scheduled"');
  });

  it('rejects notes on cancelled visits', async () => {
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeVisit({ status: 'cancelled' }));

    await expect(
      useCase.execute(
        { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, notes: 'test' },
        'corr-6',
      ),
    ).rejects.toThrow('Cannot update notes on a visit with status "cancelled"');
  });

  it('throws NotFoundError when visit does not exist', async () => {
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      useCase.execute(
        { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, notes: 'test' },
        'corr-7',
      ),
    ).rejects.toThrow('Visit not found');
  });

  it('allows member to update their own assigned visit', async () => {
    const visit = makeVisit({ status: 'started', assignedUserId: CALLER_ID });
    const updated = { ...visit, notes: 'My notes' };
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
    (visitRepo.updateNotes as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

    const result = await useCase.execute(
      { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'member', visitId: VISIT_ID, notes: 'My notes' },
      'corr-8',
    );

    expect(result.visit.notes).toBe('My notes');
  });

  it('rejects member updating another user\'s visit', async () => {
    const visit = makeVisit({ status: 'started', assignedUserId: 'other-user-id' });
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);

    await expect(
      useCase.execute(
        { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'member', visitId: VISIT_ID, notes: 'test' },
        'corr-9',
      ),
    ).rejects.toThrow('Members can only update notes on their own assigned visits');
  });
});
