import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransitionVisitStatusUseCase, getValidTransitions, isValidTransition } from '../../src/application/usecases/transition-visit-status.js';
import type { VisitRepository } from '../../src/application/ports/visit-repository.js';
import type { JobRepository } from '../../src/application/ports/job-repository.js';
import type { AuditEventRepository } from '../../src/application/ports/audit-event-repository.js';
import type { Visit } from '../../src/domain/entities/visit.js';
import type { Job } from '../../src/domain/entities/job.js';

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
    status: 'scheduled',
    notes: null,
    completedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: JOB_ID,
    tenantId: TENANT_ID,
    quoteId: '00000000-0000-0000-0000-000000000800',
    clientId: '00000000-0000-0000-0000-000000000500',
    propertyId: null,
    title: 'Test Job',
    status: 'scheduled',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('TransitionVisitStatusUseCase', () => {
  let visitRepo: VisitRepository;
  let jobRepo: JobRepository;
  let auditRepo: AuditEventRepository;
  let useCase: TransitionVisitStatusUseCase;

  beforeEach(() => {
    visitRepo = {
      create: vi.fn(),
      getById: vi.fn(),
      listByJobId: vi.fn(),
      updateSchedule: vi.fn(),
      updateAssignedUser: vi.fn(),
      updateStatus: vi.fn(),
      listByDateRange: vi.fn(),
      listUnscheduled: vi.fn(),
    };

    jobRepo = {
      create: vi.fn(),
      getById: vi.fn(),
      getByQuoteId: vi.fn(),
      list: vi.fn(),
      count: vi.fn(),
      countByStatus: vi.fn(),
      updateStatus: vi.fn(),
    };

    auditRepo = {
      record: vi.fn().mockResolvedValue(undefined),
      listBySubjects: vi.fn(),
    };

    useCase = new TransitionVisitStatusUseCase(visitRepo, jobRepo, auditRepo);
  });

  // --- Status machine validation ---

  describe('status machine', () => {
    it('allows scheduled → en_route', async () => {
      const visit = makeVisit({ status: 'scheduled' });
      const updated = makeVisit({ status: 'en_route' });
      (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
      (visitRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(updated);
      (jobRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeJob());

      const result = await useCase.execute({
        tenantId: TENANT_ID,
        callerUserId: CALLER_ID,
        callerRole: 'owner',
        visitId: VISIT_ID,
        newStatus: 'en_route',
      }, 'corr-1');

      expect(result.visit.status).toBe('en_route');
      expect(visitRepo.updateStatus).toHaveBeenCalledWith(TENANT_ID, VISIT_ID, 'en_route', ['scheduled']);
    });

    it('allows scheduled → started (skip en_route)', async () => {
      const visit = makeVisit({ status: 'scheduled' });
      const updated = makeVisit({ status: 'started' });
      (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
      (visitRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(updated);
      (jobRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeJob());
      (jobRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(makeJob({ status: 'in_progress' }));

      const result = await useCase.execute({
        tenantId: TENANT_ID,
        callerUserId: CALLER_ID,
        callerRole: 'owner',
        visitId: VISIT_ID,
        newStatus: 'started',
      }, 'corr-1');

      expect(result.visit.status).toBe('started');
    });

    it('allows en_route → started', async () => {
      const visit = makeVisit({ status: 'en_route' });
      const updated = makeVisit({ status: 'started' });
      (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
      (visitRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(updated);
      (jobRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeJob());
      (jobRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(makeJob({ status: 'in_progress' }));

      const result = await useCase.execute({
        tenantId: TENANT_ID,
        callerUserId: CALLER_ID,
        callerRole: 'owner',
        visitId: VISIT_ID,
        newStatus: 'started',
      }, 'corr-1');

      expect(result.visit.status).toBe('started');
    });

    it('allows started → completed', async () => {
      const visit = makeVisit({ status: 'started' });
      const updated = makeVisit({ status: 'completed', completedAt: new Date() });
      (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
      (visitRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(updated);
      (visitRepo.listByJobId as ReturnType<typeof vi.fn>).mockResolvedValue([updated]);
      (jobRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeJob({ status: 'in_progress' }));
      (jobRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(makeJob({ status: 'completed' }));

      const result = await useCase.execute({
        tenantId: TENANT_ID,
        callerUserId: CALLER_ID,
        callerRole: 'owner',
        visitId: VISIT_ID,
        newStatus: 'completed',
      }, 'corr-1');

      expect(result.visit.status).toBe('completed');
    });

    it('allows scheduled → cancelled (owner)', async () => {
      const visit = makeVisit({ status: 'scheduled' });
      const updated = makeVisit({ status: 'cancelled' });
      (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
      (visitRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(updated);
      (visitRepo.listByJobId as ReturnType<typeof vi.fn>).mockResolvedValue([updated]);
      (jobRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeJob());
      (jobRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(makeJob({ status: 'cancelled' }));

      const result = await useCase.execute({
        tenantId: TENANT_ID,
        callerUserId: CALLER_ID,
        callerRole: 'owner',
        visitId: VISIT_ID,
        newStatus: 'cancelled',
      }, 'corr-1');

      expect(result.visit.status).toBe('cancelled');
    });

    it('allows started → cancelled (owner)', async () => {
      const visit = makeVisit({ status: 'started' });
      const updated = makeVisit({ status: 'cancelled' });
      (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
      (visitRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(updated);
      (visitRepo.listByJobId as ReturnType<typeof vi.fn>).mockResolvedValue([updated]);
      (jobRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeJob({ status: 'in_progress' }));
      (jobRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(makeJob({ status: 'cancelled' }));

      const result = await useCase.execute({
        tenantId: TENANT_ID,
        callerUserId: CALLER_ID,
        callerRole: 'owner',
        visitId: VISIT_ID,
        newStatus: 'cancelled',
      }, 'corr-1');

      expect(result.visit.status).toBe('cancelled');
    });
  });

  // --- Job auto-derivation ---

  describe('job auto-derivation', () => {
    it('moves job to in_progress when visit started and job is scheduled', async () => {
      const visit = makeVisit({ status: 'scheduled' });
      const updated = makeVisit({ status: 'started' });
      (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
      (visitRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(updated);
      (jobRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeJob({ status: 'scheduled' }));
      (jobRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(makeJob({ status: 'in_progress' }));

      await useCase.execute({
        tenantId: TENANT_ID,
        callerUserId: CALLER_ID,
        callerRole: 'owner',
        visitId: VISIT_ID,
        newStatus: 'started',
      }, 'corr-1');

      expect(jobRepo.updateStatus).toHaveBeenCalledWith(TENANT_ID, JOB_ID, 'in_progress');
      // Audit: visit.started + job.in_progress
      expect(auditRepo.record).toHaveBeenCalledTimes(2);
      expect(auditRepo.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: 'job.in_progress' }));
    });

    it('moves job to completed when all visits completed', async () => {
      const visit = makeVisit({ status: 'started' });
      const updatedVisit = makeVisit({ status: 'completed', completedAt: new Date() });
      (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
      (visitRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(updatedVisit);
      (visitRepo.listByJobId as ReturnType<typeof vi.fn>).mockResolvedValue([updatedVisit]);
      (jobRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeJob({ status: 'in_progress' }));
      (jobRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(makeJob({ status: 'completed' }));

      await useCase.execute({
        tenantId: TENANT_ID,
        callerUserId: CALLER_ID,
        callerRole: 'owner',
        visitId: VISIT_ID,
        newStatus: 'completed',
      }, 'corr-1');

      expect(jobRepo.updateStatus).toHaveBeenCalledWith(TENANT_ID, JOB_ID, 'completed');
      expect(auditRepo.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: 'job.completed' }));
    });

    it('does not change job when some visits still open', async () => {
      const visit = makeVisit({ status: 'started' });
      const updatedVisit = makeVisit({ status: 'completed', completedAt: new Date() });
      const otherVisit = makeVisit({ id: '00000000-0000-0000-0000-000000000951', status: 'scheduled' });
      (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
      (visitRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(updatedVisit);
      (visitRepo.listByJobId as ReturnType<typeof vi.fn>).mockResolvedValue([updatedVisit, otherVisit]);

      await useCase.execute({
        tenantId: TENANT_ID,
        callerUserId: CALLER_ID,
        callerRole: 'owner',
        visitId: VISIT_ID,
        newStatus: 'completed',
      }, 'corr-1');

      expect(jobRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('moves job to cancelled when all visits cancelled', async () => {
      const visit = makeVisit({ status: 'scheduled' });
      const updatedVisit = makeVisit({ status: 'cancelled' });
      (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
      (visitRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(updatedVisit);
      (visitRepo.listByJobId as ReturnType<typeof vi.fn>).mockResolvedValue([updatedVisit]);
      (jobRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeJob());
      (jobRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(makeJob({ status: 'cancelled' }));

      await useCase.execute({
        tenantId: TENANT_ID,
        callerUserId: CALLER_ID,
        callerRole: 'owner',
        visitId: VISIT_ID,
        newStatus: 'cancelled',
      }, 'corr-1');

      expect(jobRepo.updateStatus).toHaveBeenCalledWith(TENANT_ID, JOB_ID, 'cancelled');
      expect(auditRepo.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: 'job.cancelled' }));
    });

    it('moves job to completed when mix of completed and cancelled (all terminal, ≥1 completed)', async () => {
      const visit = makeVisit({ status: 'started' });
      const updatedVisit = makeVisit({ status: 'completed', completedAt: new Date() });
      const cancelledVisit = makeVisit({ id: '00000000-0000-0000-0000-000000000951', status: 'cancelled' });
      (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
      (visitRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(updatedVisit);
      (visitRepo.listByJobId as ReturnType<typeof vi.fn>).mockResolvedValue([updatedVisit, cancelledVisit]);
      (jobRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeJob({ status: 'in_progress' }));
      (jobRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(makeJob({ status: 'completed' }));

      await useCase.execute({
        tenantId: TENANT_ID,
        callerUserId: CALLER_ID,
        callerRole: 'owner',
        visitId: VISIT_ID,
        newStatus: 'completed',
      }, 'corr-1');

      expect(jobRepo.updateStatus).toHaveBeenCalledWith(TENANT_ID, JOB_ID, 'completed');
    });
  });

  // --- RBAC ---

  describe('RBAC', () => {
    it('allows admin to transition any visit', async () => {
      const visit = makeVisit({ status: 'scheduled', assignedUserId: 'someone-else' });
      const updated = makeVisit({ status: 'en_route' });
      (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
      (visitRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

      const result = await useCase.execute({
        tenantId: TENANT_ID,
        callerUserId: CALLER_ID,
        callerRole: 'admin',
        visitId: VISIT_ID,
        newStatus: 'en_route',
      }, 'corr-1');

      expect(result.visit.status).toBe('en_route');
    });

    it('allows member to transition own assigned visit', async () => {
      const visit = makeVisit({ status: 'scheduled', assignedUserId: CALLER_ID });
      const updated = makeVisit({ status: 'started' });
      (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
      (visitRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(updated);
      (jobRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeJob());
      (jobRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(makeJob({ status: 'in_progress' }));

      const result = await useCase.execute({
        tenantId: TENANT_ID,
        callerUserId: CALLER_ID,
        callerRole: 'member',
        visitId: VISIT_ID,
        newStatus: 'started',
      }, 'corr-1');

      expect(result.visit.status).toBe('started');
    });

    it('rejects member transitioning unassigned visit', async () => {
      const visit = makeVisit({ status: 'scheduled', assignedUserId: null });
      (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);

      await expect(useCase.execute({
        tenantId: TENANT_ID,
        callerUserId: CALLER_ID,
        callerRole: 'member',
        visitId: VISIT_ID,
        newStatus: 'started',
      }, 'corr-1')).rejects.toThrow('You can only transition your own assigned visits');
    });

    it('rejects member cancelling visit', async () => {
      const visit = makeVisit({ status: 'scheduled', assignedUserId: CALLER_ID });
      (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);

      await expect(useCase.execute({
        tenantId: TENANT_ID,
        callerUserId: CALLER_ID,
        callerRole: 'member',
        visitId: VISIT_ID,
        newStatus: 'cancelled',
      }, 'corr-1')).rejects.toThrow('Only owners and admins can cancel visits');
    });
  });

  // --- Validation + errors ---

  describe('validation and errors', () => {
    it('rejects completed → started', async () => {
      const visit = makeVisit({ status: 'completed' });
      (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);

      await expect(useCase.execute({
        tenantId: TENANT_ID,
        callerUserId: CALLER_ID,
        callerRole: 'owner',
        visitId: VISIT_ID,
        newStatus: 'started',
      }, 'corr-1')).rejects.toThrow("Cannot transition from 'completed' to 'started'");
    });

    it('rejects scheduled → completed (must go through started)', async () => {
      const visit = makeVisit({ status: 'scheduled' });
      (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);

      await expect(useCase.execute({
        tenantId: TENANT_ID,
        callerUserId: CALLER_ID,
        callerRole: 'owner',
        visitId: VISIT_ID,
        newStatus: 'completed',
      }, 'corr-1')).rejects.toThrow("Cannot transition from 'scheduled' to 'completed'");
    });

    it('rejects cancelled → started', async () => {
      const visit = makeVisit({ status: 'cancelled' });
      (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);

      await expect(useCase.execute({
        tenantId: TENANT_ID,
        callerUserId: CALLER_ID,
        callerRole: 'owner',
        visitId: VISIT_ID,
        newStatus: 'started',
      }, 'corr-1')).rejects.toThrow("Cannot transition from 'cancelled' to 'started'");
    });

    it('throws NotFoundError when visit missing', async () => {
      (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(useCase.execute({
        tenantId: TENANT_ID,
        callerUserId: CALLER_ID,
        callerRole: 'owner',
        visitId: VISIT_ID,
        newStatus: 'started',
      }, 'corr-1')).rejects.toThrow('Visit not found');
    });

    it('throws ConflictError on concurrent update', async () => {
      const visit = makeVisit({ status: 'scheduled' });
      (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
      (visitRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(useCase.execute({
        tenantId: TENANT_ID,
        callerUserId: CALLER_ID,
        callerRole: 'owner',
        visitId: VISIT_ID,
        newStatus: 'en_route',
      }, 'corr-1')).rejects.toThrow('Visit status was changed concurrently');
    });
  });

  // --- Edge cases ---

  describe('edge cases', () => {
    it('does not propagate audit failure', async () => {
      const visit = makeVisit({ status: 'scheduled' });
      const updated = makeVisit({ status: 'en_route' });
      (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
      (visitRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(updated);
      (auditRepo.record as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('audit boom'));

      const result = await useCase.execute({
        tenantId: TENANT_ID,
        callerUserId: CALLER_ID,
        callerRole: 'owner',
        visitId: VISIT_ID,
        newStatus: 'en_route',
      }, 'corr-1');

      expect(result.visit.status).toBe('en_route');
    });

    it('does not propagate job derivation failure', async () => {
      const visit = makeVisit({ status: 'scheduled' });
      const updated = makeVisit({ status: 'started' });
      (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
      (visitRepo.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(updated);
      (auditRepo.record as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined); // visit audit
      (jobRepo.getById as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('job boom'));

      const result = await useCase.execute({
        tenantId: TENANT_ID,
        callerUserId: CALLER_ID,
        callerRole: 'owner',
        visitId: VISIT_ID,
        newStatus: 'started',
      }, 'corr-1');

      expect(result.visit.status).toBe('started');
    });
  });

  // --- Pure function tests ---

  describe('getValidTransitions', () => {
    it('returns correct transitions for each status', () => {
      expect(getValidTransitions('scheduled')).toEqual(['en_route', 'started', 'cancelled']);
      expect(getValidTransitions('en_route')).toEqual(['started', 'cancelled']);
      expect(getValidTransitions('started')).toEqual(['completed', 'cancelled']);
      expect(getValidTransitions('completed')).toEqual([]);
      expect(getValidTransitions('cancelled')).toEqual([]);
    });
  });

  describe('isValidTransition', () => {
    it('validates transitions correctly', () => {
      expect(isValidTransition('scheduled', 'en_route')).toBe(true);
      expect(isValidTransition('scheduled', 'started')).toBe(true);
      expect(isValidTransition('scheduled', 'completed')).toBe(false);
      expect(isValidTransition('completed', 'started')).toBe(false);
      expect(isValidTransition('cancelled', 'scheduled')).toBe(false);
    });
  });
});
