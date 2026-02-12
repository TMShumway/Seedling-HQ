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
- Phase 5: API Client Extensions
  - `apps/web/src/lib/api-client.ts` — added `VisitWithContextResponse` type (extends `VisitResponse` with `jobTitle`, `clientName`, `propertyAddress`), and 3 methods: `listVisits({ from, to, status? })`, `listUnscheduledVisits()`, `scheduleVisit(id, { scheduledStart, scheduledEnd? })`
  - `tsc --noEmit` passes in web workspace

### Summary of all backend work (Phases 1–4)
- **Phase 1 (DB + Repos):** `schema.ts` got `metadata` JSONB on `audit_events` + `visits_tenant_scheduled_start_idx` index. `AuditEvent` interface + `DrizzleAuditEventRepository` handle metadata. `VisitRepository` port now has `VisitWithContext`, `ListVisitsFilters`, `updateSchedule`, `listByDateRange`, `listUnscheduled`. `DrizzleVisitRepository` implements all with JOINs.
- **Phase 2 (DTO + Use Case):** `ScheduleVisitInput/Output` DTOs. `ScheduleVisitUseCase` — validates status=scheduled, auto-computes end from duration, status-guarded SQL update, best-effort audit (`visit.time_set` first schedule, `visit.rescheduled` subsequent with metadata).
- **Phase 3 (Routes + Wiring):** `visit-routes.ts` with 3 endpoints: `GET /v1/visits/unscheduled`, `GET /v1/visits` (date range, max 8 days), `PATCH /v1/visits/:id/schedule`. Wired in `app.ts`.
- **Phase 4 (Seed):** `seed.ts` — `getTodayAt()` helper. Existing visit now has `scheduledStart=today 9AM, scheduledEnd=+120min`. New Bob Wilson quote (0705), job (0901), unscheduled visit (0951).

### Commits so far
1. `0b77a14` — S-0013 phase 1: DB schema + repository extensions
2. `99e788b` — S-0013 phase 2: DTO + Use Case
3. `81548b6` — S-0013 phase 3: Visit routes + wiring
4. `c556eeb` — S-0013 phase 4: Seed data updates
5. (pending) — S-0013 phase 5: API client extensions

### In progress
- None
### Next up
- Phase 6: Frontend SchedulePage + Calendar Grid
  - Need to: enable Schedule nav in Sidebar.tsx (currently `active: false, href: '#'`), add `/schedule` route in App.tsx, build SchedulePage with week header/navigation, CSS Grid week view (desktop), day view (mobile)
  - Key patterns: `?week=YYYY-MM-DD` URL param for deep-linking, `useQuery` for `listVisits`, `hidden lg:grid` + `lg:hidden` for responsive
### Blockers / open questions
- None

## Test summary
- **Unit**: 0 new
- **Integration**: 0 new
- **E2E**: 0 new
