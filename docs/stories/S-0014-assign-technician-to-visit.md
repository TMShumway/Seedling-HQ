# S-0014: Assign Technician to Visit + "My Visits" Filter

## Status: In Progress

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

- [ ] **Task 2.1:** Create DTOs
- [ ] **Task 2.2:** Implement AssignVisitUseCase

## Phase 3: Visit Routes + Wiring
**Goal:** Add PATCH /v1/visits/:id/assign, extend GET endpoints with assignedUserId filter.
**Files:** `apps/api/src/adapters/http/routes/visit-routes.ts`, `apps/api/src/app.ts`

- [ ] **Task 3.1:** Add userRepo to buildVisitRoutes
- [ ] **Task 3.2:** Add assignedUserName to visitWithContextResponseSchema
- [ ] **Task 3.3:** Add assignedUserId query param to GET /v1/visits
- [ ] **Task 3.4:** Add assignedUserId query param to GET /v1/visits/unscheduled
- [ ] **Task 3.5:** Add PATCH /v1/visits/:id/assign endpoint
- [ ] **Task 3.6:** Check GET /v1/jobs/:id embedded visits
- [ ] **Task 3.7:** Verify all visit response schemas are consistent

## Phase 4: Seed Data Updates
**Goal:** Assign demo technician to first visit.
**Files:** `apps/api/src/infra/db/seed.ts`

- [ ] **Task 4.1:** Assign DEMO_MEMBER_ID to Jane Johnson's visit

## Phase 5: Frontend API Client Extensions
**Goal:** Add types and methods for assign endpoint.
**Files:** `apps/web/src/lib/api-client.ts`

- [ ] **Task 5.1:** Add assignedUserName to VisitWithContextResponse
- [ ] **Task 5.2:** Add assignedUserId param to listVisits and listUnscheduledVisits
- [ ] **Task 5.3:** Add assignVisit method
- [ ] **Task 5.4:** Verify listUsers return type

## Phase 6: Frontend — Tech Picker in ScheduleVisitModal
**Goal:** Add technician assignment dropdown.
**Files:** `apps/web/src/components/schedule/ScheduleVisitModal.tsx`

- [ ] **Task 6.1:** Fetch team members list
- [ ] **Task 6.2:** Add select dropdown
- [ ] **Task 6.3:** Role-gate the dropdown
- [ ] **Task 6.4:** Wire assignment into modal submit
- [ ] **Task 6.5:** Support assign-only for already-scheduled visits

## Phase 7: Frontend — Calendar Display + "My Visits" + JobDetail
**Goal:** Show assignedUserName on calendar, add toggle, update JobDetailPage.
**Files:** `apps/web/src/pages/SchedulePage.tsx`, `apps/web/src/pages/JobDetailPage.tsx`

- [ ] **Task 7.1:** Display assignedUserName on VisitBlock
- [ ] **Task 7.2:** Display assignedUserName on unscheduled cards
- [ ] **Task 7.3:** Add "My Visits" toggle
- [ ] **Task 7.4:** Combine mine with week query param
- [ ] **Task 7.5:** Update JobDetailPage visits
- [ ] **Task 7.6:** Add navigate-to-schedule action
- [ ] **Task 7.7:** Empty state for "My Visits"

## Phase 8: Tests
**Goal:** Unit, integration, E2E coverage.
**Files:** `apps/api/test/unit/assign-visit.test.ts`, `apps/api/test/integration/visit-routes.test.ts`, `e2e/tests/schedule.spec.ts`

- [ ] **Task 8.1:** Unit tests for AssignVisitUseCase
- [ ] **Task 8.2:** Integration tests for assign + filter routes
- [ ] **Task 8.3:** Update existing test mocks
- [ ] **Task 8.4:** E2E tests

## Phase 9: Documentation
**Goal:** Story file, CLAUDE.md, domain model doc.

- [ ] **Task 9.1:** Create story file
- [ ] **Task 9.2:** Update CLAUDE.md
- [ ] **Task 9.3:** Update domain model doc

## Resume context
### Last completed
- Phase 1 complete: schema index, port interface, Drizzle implementation all updated
### In progress
- Starting Phase 2
### Next up
- Create DTOs (assign-visit-dto.ts) and AssignVisitUseCase
### Blockers / open questions
- None

## Test summary
- **Unit**: 0 new
- **Integration**: 0 new
- **E2E**: 0 new
