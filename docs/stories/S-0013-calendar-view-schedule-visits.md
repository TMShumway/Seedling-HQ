# S-0013: Calendar View (Week/Day) + Schedule/Reschedule Visits

## Status: In Progress

## Overview
Adds a calendar-based schedule view (week + day) and the ability to schedule/reschedule visits via a modal form and dedicated API endpoints. Builds on S-0012's Job + Visit foundation. Visits currently have nullable `scheduledStart`/`scheduledEnd` — this story adds time assignment through a calendar UI.

## Key decisions
- Decision: Calendar UI — Chosen: Hand-built CSS Grid week view — Why: No new deps, consistent with project philosophy
- Decision: Schedule form — Chosen: Card-based modal overlay (ResetPasswordDialog pattern)
- Decision: Unscheduled visits — Chosen: Horizontal panel above calendar grid, click-to-schedule
- Decision: Week navigation — Chosen: URL query param `?week=YYYY-MM-DD` for deep-linking
- Decision: Visit routes — Chosen: Flat `/v1/visits/*` (same as `/v1/properties/:id`)
- Decision: Audit events — Chosen: `visit.time_set` (first) + `visit.rescheduled` (subsequent) with metadata JSONB
- Decision: No UoW — Chosen: Direct repo + best-effort audit (single entity write)
- Decision: Range limit — Chosen: Max 8-day window on `GET /v1/visits`

## Phase 1: DB Schema + Repository Extensions
- [x] **1.1: Add JSONB metadata column to audit_events**
- [x] **1.2: Add composite index (tenant_id, scheduled_start) to visits**
- [x] **1.3: Define VisitWithContext type + new methods in visit-repository port**
- [x] **1.4: Implement updateSchedule() in DrizzleVisitRepository**
- [x] **1.5: Implement listByDateRange() in DrizzleVisitRepository**
- [x] **1.6: Implement listUnscheduled() in DrizzleVisitRepository**

## Phase 2: DTO + Use Case
- [x] **2.1: Create ScheduleVisitInput/Output DTOs**
- [x] **2.2: Implement ScheduleVisitUseCase**

## Phase 3: Visit Routes + Wiring
- [ ] **3.1: Create visit-routes.ts with GET /v1/visits/unscheduled**
- [ ] **3.2: Add GET /v1/visits with date range query**
- [ ] **3.3: Add PATCH /v1/visits/:id/schedule**
- [ ] **3.4: Wire buildVisitRoutes into app.ts**

## Phase 4: Seed Data Updates
- [ ] **4.1: Give existing demo visit scheduled times**
- [ ] **4.2: Add second job + unscheduled visit for Bob Wilson**

## Phase 5: API Client Extensions
- [ ] **5.1: Add VisitWithContextResponse type + 3 API methods**

## Phase 6: Frontend — SchedulePage + Calendar Grid
- [ ] **6.1: Enable Schedule nav + add route**
- [ ] **6.2: Create SchedulePage with week header + navigation**
- [ ] **6.3: Build week view calendar grid (desktop)**
- [ ] **6.4: Build day view (mobile)**

## Phase 7: Frontend — Unscheduled Panel + Schedule Modal
- [ ] **7.1: Add unscheduled visits panel above calendar**
- [ ] **7.2: Create ScheduleVisitModal component**
- [ ] **7.3: Wire click interactions on SchedulePage**
- [ ] **7.4: Update JobDetailPage with schedule actions**

## Phase 8: Tests
- [ ] **8.1: Unit tests for ScheduleVisitUseCase**
- [ ] **8.2: Integration tests for visit routes**
- [ ] **8.3: Update existing test mocks**
- [ ] **8.4: E2E tests**

## Phase 9: Documentation
- [ ] **9.1: Update story file to Complete**
- [ ] **9.2: Update CLAUDE.md**
- [ ] **9.3: Update domain model doc**

## Resume context
### Last completed
- Phase 2: DTO + Use Case
  - `apps/api/src/application/dto/schedule-visit-dto.ts` — ScheduleVisitInput/Output DTOs
  - `apps/api/src/application/usecases/schedule-visit.ts` — ScheduleVisitUseCase with status guard, auto-computed end, first-schedule vs reschedule audit metadata
- Phase 1: DB Schema + Repository Extensions
  - `apps/api/src/infra/db/schema.ts` — added `metadata` JSONB column to `auditEvents`, added `visits_tenant_scheduled_start_idx` index
  - `apps/api/src/application/ports/audit-event-repository.ts` — added `metadata?: Record<string, unknown> | null` to `AuditEvent` interface
  - `apps/api/src/infra/db/repositories/drizzle-audit-event-repository.ts` — passes metadata through in `record()` and `toEntity()`
  - `apps/api/src/application/ports/visit-repository.ts` — added `VisitWithContext`, `ListVisitsFilters`, `updateSchedule`, `listByDateRange`, `listUnscheduled`
  - `apps/api/src/infra/db/repositories/drizzle-visit-repository.ts` — implemented all 3 new methods with JOINs + status guards
  - `tsc --noEmit` passes, `db:push` applied
### In progress
- None
### Next up
- Phase 3: Visit Routes + Wiring
### Blockers / open questions
- None

## Test summary
- **Unit**: 0 new
- **Integration**: 0 new
- **E2E**: 0 new
