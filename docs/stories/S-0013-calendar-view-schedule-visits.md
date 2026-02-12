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
- [x] **3.1: Create visit-routes.ts with GET /v1/visits/unscheduled**
- [x] **3.2: Add GET /v1/visits with date range query**
- [x] **3.3: Add PATCH /v1/visits/:id/schedule**
- [x] **3.4: Wire buildVisitRoutes into app.ts**

## Phase 4: Seed Data Updates
- [x] **4.1: Give existing demo visit scheduled times**
- [x] **4.2: Add second job + unscheduled visit for Bob Wilson**

## Phase 5: API Client Extensions
- [x] **5.1: Add VisitWithContextResponse type + 3 API methods**

## Phase 6: Frontend — SchedulePage + Calendar Grid
- [x] **6.1: Enable Schedule nav + add route**
- [x] **6.2: Create SchedulePage with week header + navigation**
- [x] **6.3: Build week view calendar grid (desktop)**
- [x] **6.4: Build day view (mobile)**

## Phase 7: Frontend — Unscheduled Panel + Schedule Modal
- [x] **7.1: Add unscheduled visits panel above calendar**
- [x] **7.2: Create ScheduleVisitModal component**
- [x] **7.3: Wire click interactions on SchedulePage**
- [x] **7.4: Update JobDetailPage with schedule actions**

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
- Phase 7: Unscheduled Panel + Schedule Modal
  - `apps/web/src/pages/SchedulePage.tsx` — added `useQuery(['unscheduled-visits'])`, horizontal scroll panel of amber-styled unscheduled cards above calendar, modal integration for both schedule + reschedule
  - `apps/web/src/components/schedule/ScheduleVisitModal.tsx` — Card overlay modal with `<input type="datetime-local">`, auto-computed end display, `useMutation` calling `scheduleVisit`, invalidates queries on success
  - `apps/web/src/pages/JobDetailPage.tsx` — scheduled visits: time is now a `<Link>` to `/schedule?week=YYYY-MM-DD`; unscheduled visits: "Schedule" button navigates to `/schedule`
- Phases 1–6 all complete (backend + frontend calendar)

### Commits so far
1. `0b77a14` — phase 1 (DB + repos)
2. `99e788b` — phase 2 (DTO + use case)
3. `81548b6` — phase 3 (routes + wiring)
4. `c556eeb` — phase 4 (seed data)
5. `9f4815d` — phase 5 (API client)
6. `cc357a8` — phase 6 (SchedulePage + calendar grid)
7. (pending) — phase 7 (unscheduled panel + modal)

### In progress
- None

### Next up
- Phase 8: Tests
  - **8.1: Unit tests** for `ScheduleVisitUseCase` — file: `apps/api/test/unit/schedule-visit.test.ts` (new)
    - Happy paths: first schedule (emits `visit.time_set`), reschedule (emits `visit.rescheduled` with previous/new timestamps in metadata)
    - Auto-computed end from `estimatedDurationMinutes`, custom end time accepted
    - Rejections: end before start, non-scheduled status (→ ValidationError), missing visit (→ NotFoundError)
    - ConflictError when `updateSchedule` returns null (concurrent status change)
    - Audit failure doesn't propagate
  - **8.2: Integration tests** for visit routes — file: `apps/api/test/integration/visit-routes.test.ts` (new)
    - PATCH schedule: start only, start+end, reschedule, end-before-start 400, wrong status 400, not-found 404, concurrent conflict
    - GET visits: range query returns correct visits, excludes out-of-range, includes context fields (jobTitle/clientName/propertyAddress), 400 for from >= to, 400 for range > 8 days
    - GET unscheduled: returns only unscheduled visits
    - Tenant isolation
  - **8.3: Update existing test mocks** — grep all test files mocking VisitRepository, add `updateSchedule`, `listByDateRange`, `listUnscheduled`; verify audit metadata compatibility
  - **8.4: E2E tests** — file: `e2e/tests/schedule.spec.ts` (new)
    - Schedule page renders with week calendar
    - Unscheduled visits panel visible
    - Schedule a visit via modal
    - Reschedule via calendar click
    - Week navigation
    - Accessibility check

### Exhaustive file inventory (all changes in this story)
**New files:**
- `apps/api/src/application/dto/schedule-visit-dto.ts` — ScheduleVisitInput/Output
- `apps/api/src/application/usecases/schedule-visit.ts` — ScheduleVisitUseCase
- `apps/api/src/adapters/http/routes/visit-routes.ts` — 3 endpoints (GET /v1/visits, GET /v1/visits/unscheduled, PATCH /v1/visits/:id/schedule)
- `apps/web/src/pages/SchedulePage.tsx` — Full calendar page (week + day view)
- `apps/web/src/components/schedule/ScheduleVisitModal.tsx` — Schedule modal overlay
- `docs/stories/S-0013-calendar-view-schedule-visits.md` — Story file

**Modified files:**
- `apps/api/src/infra/db/schema.ts` — added `metadata` JSONB column to `auditEvents` table, added `visits_tenant_scheduled_start_idx` index
- `apps/api/src/application/ports/audit-event-repository.ts` — added `metadata?: Record<string, unknown> | null` to `AuditEvent` interface
- `apps/api/src/infra/db/repositories/drizzle-audit-event-repository.ts` — passes metadata through in `record()` and `toEntity()`
- `apps/api/src/application/ports/visit-repository.ts` — added `VisitWithContext`, `ListVisitsFilters`, 3 new methods
- `apps/api/src/infra/db/repositories/drizzle-visit-repository.ts` — implemented `updateSchedule()`, `listByDateRange()`, `listUnscheduled()` with JOINs
- `apps/api/src/app.ts` — wired `buildVisitRoutes`
- `apps/api/src/infra/db/seed.ts` — `getTodayAt()` helper, scheduled times on existing visit, Bob Wilson quote/job/unscheduled visit
- `apps/web/src/lib/api-client.ts` — `VisitWithContextResponse` type + `listVisits`, `listUnscheduledVisits`, `scheduleVisit` methods
- `apps/web/src/app-shell/Sidebar.tsx` — enabled Schedule nav (`active: true, href: '/schedule'`)
- `apps/web/src/App.tsx` — added `/schedule` route + import
- `apps/web/src/pages/JobDetailPage.tsx` — scheduled visit times are links to `/schedule?week=`, unscheduled visits have "Schedule" button

### Key implementation details for tests
- `ScheduleVisitUseCase` constructor takes `(visitRepo, auditRepo)` — no UoW
- `updateSchedule()` uses SQL `WHERE status='scheduled'` — returns null if status changed (→ ConflictError)
- Audit uses `metadata` field: `{ newStart, newEnd }` for `visit.time_set`, `{ previousStart, previousEnd, newStart, newEnd }` for `visit.rescheduled`
- Visit routes use `z.string().datetime({ offset: true })` for ISO datetime validation
- GET /v1/visits enforces `from < to` and `to - from <= 8 days` at route level
- GET /v1/visits/unscheduled registered BEFORE any `:id` routes in Fastify
- Seed data IDs: DEMO_VISIT_ID=`...0950`, DEMO_BOB_VISIT_ID=`...0951`, DEMO_JOB_ID=`...0900`, DEMO_BOB_JOB_ID=`...0901`

### Blockers / open questions
- None
### Blockers / open questions
- None

## Test summary
- **Unit**: 0 new
- **Integration**: 0 new
- **E2E**: 0 new
