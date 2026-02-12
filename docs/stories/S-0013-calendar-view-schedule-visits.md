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
- [x] **8.1: Unit tests for ScheduleVisitUseCase**
- [x] **8.2: Integration tests for visit routes**
- [x] **8.3: Update existing test mocks**
- [x] **8.4: E2E tests**

## Phase 9: Documentation
- [ ] **9.1: Update story file to Complete**
- [ ] **9.2: Update CLAUDE.md**
- [ ] **9.3: Update domain model doc**

## Resume context
### Last completed
- Phase 8: Tests (all passing)
  - `apps/api/test/unit/schedule-visit.test.ts` — 11 unit tests for ScheduleVisitUseCase (first schedule, reschedule, custom end, auto-computed end, not found, wrong status, end before start, end equals start, conflict error, audit failure, reschedule with null previous end)
  - `apps/api/test/integration/visit-routes.test.ts` — 15 integration tests for visit routes (PATCH schedule: start only, start+end, reschedule, end-before-start 400, not-found 404, tenant isolation; GET visits: range query, excludes out-of-range, context fields, from>=to 400, range>8 days 400, exactly 8-day range OK; GET unscheduled: returns unscheduled, excludes scheduled, tenant isolation)
  - `apps/api/test/unit/create-job-from-quote.test.ts` — added `updateSchedule`, `listByDateRange`, `listUnscheduled` to visitRepo mocks (both standalone and txRepos)
  - `e2e/tests/schedule.spec.ts` — 7 E2E tests (page render, seeded visit on calendar, unscheduled panel, schedule via modal, reschedule via click, week navigation, a11y)
  - `e2e/tests/jobs.spec.ts` — updated job count assertions from 1 to 2 (Bob Wilson job added in seed)
  - `apps/web/src/pages/SchedulePage.tsx` — added aria-labels to prev/next week buttons and prev/next day buttons for a11y compliance
- Phases 1–7 all complete (backend + frontend)

### Commits so far
1. `0b77a14` — phase 1 (DB + repos)
2. `99e788b` — phase 2 (DTO + use case)
3. `81548b6` — phase 3 (routes + wiring)
4. `c556eeb` — phase 4 (seed data)
5. `9f4815d` — phase 5 (API client)
6. `cc357a8` — phase 6 (SchedulePage + calendar grid)
7. `26c19b5` — phase 7 (unscheduled panel + modal)
8. (pending) — phase 8 (tests)

### In progress
- None

### Next up
- Phase 9: Documentation
  - 9.1: Update story file to Complete
  - 9.2: Update CLAUDE.md with new decisions + patterns
  - 9.3: Update domain model doc with new audit events

### Blockers / open questions
- None

## Test summary
- **Unit**: 240 total (11 new)
- **Integration**: 214 total (15 new)
- **E2E**: 154 total / 103 passed + 51 skipped (7 new)
