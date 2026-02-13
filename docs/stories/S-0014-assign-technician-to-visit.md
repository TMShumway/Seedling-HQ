# S-0014: Assign Technician to Visit + "My Visits" Filter

## Status: Complete

## Overview
Third story in Epic 0005 (Scheduling). Makes the existing `assignedUserId` column on visits functional: API endpoint to assign/unassign, frontend tech picker in the schedule modal, "My Visits" toggle on the calendar, and audit trail.

## Key decisions
- Assign endpoint: `PATCH /v1/visits/:id/assign` (separate from `/schedule`)
- Unassign: same endpoint with `assignedUserId: null`
- No status guard on assign (status-independent)
- RBAC: Owner + Admin can assign; Member cannot
- Use case: Direct repo + best-effort audit (no UoW) — follows ScheduleVisitUseCase pattern
- Audit events: `visit.assigned` + `visit.unassigned` with metadata
- "My Visits": `?assignedUserId=` filter on existing GET endpoints + toggle button on SchedulePage
- VisitWithContext extended with `assignedUserName: string | null` via LEFT JOIN users

## Phase 1: DB Schema + Repository Extensions
**Goal:** Add index, extend VisitRepository with updateAssignedUser, add assignedUserId filter, add assignedUserName to VisitWithContext.
**Files:** `apps/api/src/infra/db/schema.ts`, `apps/api/src/application/ports/visit-repository.ts`, `apps/api/src/infra/db/repositories/drizzle-visit-repository.ts`

- [x] **Task 1.1:** Add composite index `(tenant_id, assigned_user_id)` to visits table
- [x] **Task 1.2:** Add `assignedUserName: string | null` to `VisitWithContext` interface
- [x] **Task 1.3:** Add `assignedUserId?: string` to `ListVisitsFilters` interface
- [x] **Task 1.4:** Add `updateAssignedUser()` to VisitRepository interface
- [x] **Task 1.5:** Add `filters?: ListVisitsFilters` param to `listUnscheduled`
- [x] **Task 1.6:** Implement `updateAssignedUser()` in DrizzleVisitRepository
- [x] **Task 1.7:** Add LEFT JOIN users to `listByDateRange()` and `listUnscheduled()`
- [x] **Task 1.8:** Add `assignedUserId` filter to both list methods

## Phase 2: DTO + Use Case
**Goal:** Create AssignVisitUseCase.
**Files:** `apps/api/src/application/dto/assign-visit-dto.ts`, `apps/api/src/application/usecases/assign-visit.ts`

- [x] **Task 2.1:** Create DTOs
- [x] **Task 2.2:** Implement AssignVisitUseCase

## Phase 3: Visit Routes + Wiring
**Goal:** Add PATCH /v1/visits/:id/assign, extend GET endpoints with assignedUserId filter.
**Files:** `apps/api/src/adapters/http/routes/visit-routes.ts`, `apps/api/src/app.ts`

- [x] **Task 3.1:** Add userRepo to buildVisitRoutes
- [x] **Task 3.2:** Add assignedUserName to visitWithContextResponseSchema
- [x] **Task 3.3:** Add assignedUserId query param to GET /v1/visits
- [x] **Task 3.4:** Add assignedUserId query param to GET /v1/visits/unscheduled
- [x] **Task 3.5:** Add PATCH /v1/visits/:id/assign endpoint
- [x] **Task 3.6:** Check GET /v1/jobs/:id embedded visits — no change needed (uses plain Visit, not VisitWithContext)
- [x] **Task 3.7:** Verify all visit response schemas are consistent

## Phase 4: Seed Data Updates
**Goal:** Assign demo technician to first visit.
**Files:** `apps/api/src/infra/db/seed.ts`

- [x] **Task 4.1:** Assign DEMO_MEMBER_ID to Jane Johnson's visit

## Phase 5: Frontend API Client Extensions
**Goal:** Add types and methods for assign endpoint.
**Files:** `apps/web/src/lib/api-client.ts`

- [x] **Task 5.1:** Add assignedUserName to VisitWithContextResponse
- [x] **Task 5.2:** Add assignedUserId param to listVisits and listUnscheduledVisits
- [x] **Task 5.3:** Add assignVisit method
- [x] **Task 5.4:** Verify listUsers return type — confirmed already has needed fields

## Phase 6: Frontend — Tech Picker in ScheduleVisitModal
**Goal:** Add technician assignment dropdown.
**Files:** `apps/web/src/components/schedule/ScheduleVisitModal.tsx`

- [x] **Task 6.1:** Fetch team members list with useQuery
- [x] **Task 6.2:** Add `<select>` dropdown for technician assignment
- [x] **Task 6.3:** Role-gate dropdown (hidden for members)
- [x] **Task 6.4:** Wire assignment into modal submit with partial success handling
- [x] **Task 6.5:** Support assign-only for already-scheduled visits (detect time change vs assignment change)

## Phase 7: Frontend — Calendar Display + "My Visits" + JobDetail
**Goal:** Show assignedUserName on calendar, add toggle, update JobDetailPage.
**Files:** `apps/web/src/pages/SchedulePage.tsx`, `apps/web/src/pages/JobDetailPage.tsx`

- [x] **Task 7.1:** Display assignedUserName on VisitBlock (with data-testid)
- [x] **Task 7.2:** Display assignedUserName on unscheduled cards ("Unassigned" fallback)
- [x] **Task 7.3:** Add "My Visits" toggle button with URL param `?mine=true`
- [x] **Task 7.4:** Combine mine with week query param in navigation
- [x] **Task 7.5:** Update JobDetailPage visits to show "Assigned to: Name" or "Unassigned" via cached users list
- [x] **Task 7.6:** Add "Assign" link for owner/admin on visit cards → navigates to /schedule
- [x] **Task 7.7:** Empty state for "My Visits" when no visits assigned

## Phase 8: Tests
**Goal:** Unit, integration, E2E coverage.
**Files:** `apps/api/test/unit/assign-visit.test.ts`, `apps/api/test/integration/visit-routes.test.ts`, `e2e/tests/schedule.spec.ts`

- [x] **Task 8.1:** Unit tests for AssignVisitUseCase (12 tests — assign, reassign, unassign, no-op, admin allowed, member forbidden, visit not found, user not found, inactive user, updateAssignedUser returns null, audit failure doesn't propagate, no status guard)
- [x] **Task 8.2:** Integration tests for assign + filter routes (14 tests — PATCH assign, reassign, unassign, member 403, not-found visit, not-found user, inactive user, tenant isolation; GET with assignedUserId filter, no match returns empty, includes assignedUserName, null when unassigned; unscheduled filter, no match)
- [x] **Task 8.3:** Updated mocks in schedule-visit.test.ts and create-job-from-quote.test.ts (added updateAssignedUser to visitRepo mocks)
- [x] **Task 8.4:** E2E tests (5 tests — assignee name on calendar block, unassigned text on cards, tech picker dropdown visible, assign via modal, My Visits toggle)

## Phase 9: Documentation
**Goal:** Story file, CLAUDE.md, domain model doc.

- [x] **Task 9.1:** Update story file status to Complete
- [x] **Task 9.2:** Update CLAUDE.md with new decisions + patterns
- [x] **Task 9.3:** Update domain model doc with audit events

## Resume context
_Story complete. All phases implemented, tested, and documented._

## Test summary
- **Unit**: 252 total (12 new) — all passing
- **Integration**: 228 total (14 new) — all passing
- **E2E**: 164 total (5 new), 108 passed + 56 skipped — all passing
- **Web**: 53 total — all passing

## Commits (on `story/S-0014-assign-technician-to-visit`)
1. `b14bc0f` S-0014 phase 1: DB schema + repository extensions
2. `0db915c` S-0014 phase 2: AssignVisitUseCase and DTO
3. `fcfa1fe` S-0014 phase 3: Wire assign endpoint and filter params
4. `2e391fb` S-0014 phase 4: Assign demo member to seeded visit
5. `139fd95` S-0014 phase 5: Frontend API client extensions
6. `463798b` S-0014 phase 6: Tech picker in ScheduleVisitModal
7. `1bbf745` S-0014 phase 7: Display assignee names and My Visits filter
8. `f1a0bcb` S-0014 phase 8: Unit, integration, and E2E tests
