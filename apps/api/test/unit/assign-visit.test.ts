import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssignVisitUseCase } from '../../src/application/usecases/assign-visit.js';
import type { VisitRepository } from '../../src/application/ports/visit-repository.js';
import type { UserRepository } from '../../src/application/ports/user-repository.js';
import type { AuditEventRepository } from '../../src/application/ports/audit-event-repository.js';
import type { Visit } from '../../src/domain/entities/visit.js';
import type { User } from '../../src/domain/entities/user.js';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const CALLER_ID = '00000000-0000-0000-0000-000000000010';
const VISIT_ID = '00000000-0000-0000-0000-000000000950';
const JOB_ID = '00000000-0000-0000-0000-000000000900';
const USER_A_ID = '00000000-0000-0000-0000-000000000011';
const USER_B_ID = '00000000-0000-0000-0000-000000000012';

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

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: USER_A_ID,
    tenantId: TENANT_ID,
    email: 'user@test.com',
    fullName: 'Test User',
    role: 'member',
    passwordHash: null,
    status: 'active',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('AssignVisitUseCase', () => {
  let visitRepo: VisitRepository;
  let userRepo: UserRepository;
  let auditRepo: AuditEventRepository;
  let useCase: AssignVisitUseCase;

  beforeEach(() => {
    visitRepo = {
      create: vi.fn(),
      getById: vi.fn(),
      listByJobId: vi.fn(),
      updateSchedule: vi.fn(),
      updateAssignedUser: vi.fn(),
      listByDateRange: vi.fn(),
      listUnscheduled: vi.fn(),
    };

    userRepo = {
      create: vi.fn(),
      getById: vi.fn(),
      getByIdGlobal: vi.fn(),
      getByEmail: vi.fn(),
      getOwnerByTenantId: vi.fn(),
      listActiveByEmail: vi.fn(),
      listByTenantId: vi.fn(),
      updatePasswordHash: vi.fn(),
      updateStatus: vi.fn(),
      updateUser: vi.fn(),
    };

    auditRepo = {
      record: vi.fn(),
      listBySubjects: vi.fn(),
    };

    useCase = new AssignVisitUseCase(visitRepo, userRepo, auditRepo);
  });

  it('assigns a user to an unassigned visit and emits visit.assigned', async () => {
    const visit = makeVisit();
    const targetUser = makeUser({ id: USER_A_ID, fullName: 'Alice Tech' });

    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
    (userRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(targetUser);
    (visitRepo.updateAssignedUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...visit,
      assignedUserId: USER_A_ID,
      updatedAt: new Date(),
    });

    const result = await useCase.execute(
      { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, assignedUserId: USER_A_ID },
      'corr-1',
    );

    expect(result.visit.assignedUserId).toBe(USER_A_ID);
    expect(visitRepo.updateAssignedUser).toHaveBeenCalledWith(TENANT_ID, VISIT_ID, USER_A_ID);

    const auditCall = (auditRepo.record as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(auditCall.eventName).toBe('visit.assigned');
    expect(auditCall.metadata).toEqual({
      assignedUserId: USER_A_ID,
      assignedUserName: 'Alice Tech',
    });
  });

  it('reassigns a visit and emits visit.assigned with previousUserId', async () => {
    const visit = makeVisit({ assignedUserId: USER_A_ID });
    const prevUser = makeUser({ id: USER_A_ID, fullName: 'Alice Tech' });
    const newUser = makeUser({ id: USER_B_ID, fullName: 'Bob Tech' });

    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
    (userRepo.getById as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(newUser) // validation lookup
      .mockResolvedValueOnce(prevUser); // previous user lookup for audit
    (visitRepo.updateAssignedUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...visit,
      assignedUserId: USER_B_ID,
      updatedAt: new Date(),
    });

    const result = await useCase.execute(
      { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, assignedUserId: USER_B_ID },
      'corr-2',
    );

    expect(result.visit.assignedUserId).toBe(USER_B_ID);

    const auditCall = (auditRepo.record as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(auditCall.eventName).toBe('visit.assigned');
    expect(auditCall.metadata).toEqual({
      assignedUserId: USER_B_ID,
      assignedUserName: 'Bob Tech',
      previousUserId: USER_A_ID,
      previousUserName: 'Alice Tech',
    });
  });

  it('unassigns a visit and emits visit.unassigned with previousUserId', async () => {
    const visit = makeVisit({ assignedUserId: USER_A_ID });
    const prevUser = makeUser({ id: USER_A_ID, fullName: 'Alice Tech' });

    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
    (userRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(prevUser);
    (visitRepo.updateAssignedUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...visit,
      assignedUserId: null,
      updatedAt: new Date(),
    });

    const result = await useCase.execute(
      { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, assignedUserId: null },
      'corr-3',
    );

    expect(result.visit.assignedUserId).toBeNull();

    const auditCall = (auditRepo.record as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(auditCall.eventName).toBe('visit.unassigned');
    expect(auditCall.metadata).toEqual({
      previousUserId: USER_A_ID,
      previousUserName: 'Alice Tech',
    });
  });

  it('returns existing visit unchanged when assignment has not changed (no-op)', async () => {
    const visit = makeVisit({ assignedUserId: USER_A_ID });

    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
    (userRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser({ id: USER_A_ID }));

    const result = await useCase.execute(
      { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, assignedUserId: USER_A_ID },
      'corr-4',
    );

    expect(result.visit).toBe(visit);
    expect(visitRepo.updateAssignedUser).not.toHaveBeenCalled();
    expect(auditRepo.record).not.toHaveBeenCalled();
  });

  it('allows admin role to assign', async () => {
    const visit = makeVisit();
    const targetUser = makeUser({ id: USER_A_ID });

    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
    (userRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(targetUser);
    (visitRepo.updateAssignedUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...visit,
      assignedUserId: USER_A_ID,
      updatedAt: new Date(),
    });

    const result = await useCase.execute(
      { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'admin', visitId: VISIT_ID, assignedUserId: USER_A_ID },
      'corr-5',
    );

    expect(result.visit.assignedUserId).toBe(USER_A_ID);
  });

  it('throws ForbiddenError when caller is member', async () => {
    await expect(
      useCase.execute(
        { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'member', visitId: VISIT_ID, assignedUserId: USER_A_ID },
        'corr-6',
      ),
    ).rejects.toThrow('Only owners and admins can assign technicians');
  });

  it('throws NotFoundError when visit does not exist', async () => {
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      useCase.execute(
        { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, assignedUserId: USER_A_ID },
        'corr-7',
      ),
    ).rejects.toThrow('Visit not found');
  });

  it('throws NotFoundError when target user does not exist', async () => {
    const visit = makeVisit();
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
    (userRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      useCase.execute(
        { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, assignedUserId: USER_A_ID },
        'corr-8',
      ),
    ).rejects.toThrow('User not found');
  });

  it('throws ValidationError when target user is inactive', async () => {
    const visit = makeVisit();
    const inactiveUser = makeUser({ id: USER_A_ID, status: 'disabled' });

    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
    (userRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(inactiveUser);

    await expect(
      useCase.execute(
        { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, assignedUserId: USER_A_ID },
        'corr-9',
      ),
    ).rejects.toThrow('Cannot assign to an inactive user');
  });

  it('throws NotFoundError when updateAssignedUser returns null', async () => {
    const visit = makeVisit();
    const targetUser = makeUser({ id: USER_A_ID });

    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
    (userRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(targetUser);
    (visitRepo.updateAssignedUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      useCase.execute(
        { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, assignedUserId: USER_A_ID },
        'corr-10',
      ),
    ).rejects.toThrow('Visit not found');
  });

  it('does not propagate audit failure', async () => {
    const visit = makeVisit();
    const targetUser = makeUser({ id: USER_A_ID, fullName: 'Alice Tech' });

    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
    (userRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(targetUser);
    (visitRepo.updateAssignedUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...visit,
      assignedUserId: USER_A_ID,
      updatedAt: new Date(),
    });
    (auditRepo.record as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Audit DB down'));

    const result = await useCase.execute(
      { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, assignedUserId: USER_A_ID },
      'corr-11',
    );

    expect(result.visit.assignedUserId).toBe(USER_A_ID);
  });

  it('assigns regardless of visit status (no status guard)', async () => {
    // Visit with status "completed" should still be assignable
    const visit = makeVisit({ status: 'completed' });
    const targetUser = makeUser({ id: USER_A_ID });

    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(visit);
    (userRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(targetUser);
    (visitRepo.updateAssignedUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...visit,
      assignedUserId: USER_A_ID,
      updatedAt: new Date(),
    });

    const result = await useCase.execute(
      { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, assignedUserId: USER_A_ID },
      'corr-12',
    );

    expect(result.visit.assignedUserId).toBe(USER_A_ID);
  });
});
