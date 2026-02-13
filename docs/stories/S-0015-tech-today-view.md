# S-0015: Tech "Today" View — Visit Status Transitions + Job Auto-Derivation

## Status: Complete

## Overview
Fourth story in Epic 0005 (Scheduling). Makes visits actionable: technicians can transition visit statuses (`scheduled -> en_route -> started -> completed`), job status auto-derives from visit statuses, and a mobile-first "Today" page shows assigned visits with status action buttons. Owners/admins can also cancel visits and transition statuses from the job detail page.

## Key decisions
- Decision: Status transition endpoint — Chosen: `PATCH /v1/visits/:id/status` with `{ status }` body — Why: Single endpoint for all forward transitions; simpler than per-status endpoints
- Decision: Status machine — Chosen: `scheduled -> [en_route, started, cancelled]`, `en_route -> [started, cancelled]`, `started -> [completed, cancelled]`, terminal: completed/cancelled — Why: `scheduled -> completed` NOT allowed (must pass through `started`); en_route optional
- Decision: RBAC — Chosen: cancel = owner/admin only; forward transitions: owner/admin any, member only own assigned visit — Why: Members shouldn't cancel; members should only act on their own visits
- Decision: Job auto-derivation — Chosen: Best-effort inside TransitionVisitStatusUseCase after visit update — Why: Same no-UoW best-effort pattern; avoids event bus
- Decision: Job derivation rules — Chosen: started + job scheduled -> in_progress; all terminal: all cancelled -> cancelled, >=1 completed -> completed — Why: Explicit rules for terminal-visit combinations
- Decision: Today page route — Chosen: `/today` inside AppShell — Why: Authenticated, all roles see it
- Decision: Today nav position — Chosen: Between Dashboard and Services — Why: Primary nav for techs
- Decision: VisitWithContext extension — Chosen: Add clientPhone + clientEmail via JOIN — Why: Avoids N+1 queries for tel: and email links on Today cards
- Decision: E2E test isolation — Chosen: Seed a third visit (John Smith, 2 PM) for Today tests — Why: schedule.spec.ts mutates Jane Johnson's visit; John Smith's visit is untouched

## Phase 0: Branch Setup
**Goal:** Create story branch from latest main.
- [x] **0.1: Checkout story branch** — `story/S-0015-tech-today-view` from main

## Phase 1-2: Visit + Job Repository Extensions
**Goal:** Add `updateStatus` to VisitRepository and JobRepository ports and implementations; extend VisitWithContext with clientPhone/clientEmail.
**Files:** `visit-repository.ts`, `drizzle-visit-repository.ts`, `job-repository.ts`, `drizzle-job-repository.ts`
- [x] **1.1: Add `updateStatus` to VisitRepository port** — `updateStatus(tenantId, id, status, expectedStatuses[]): Promise<Visit | null>`
- [x] **1.2: Implement in DrizzleVisitRepository** — WHERE `status IN (expectedStatuses)` guard; sets `completedAt` when completing
- [x] **2.1: Add `updateStatus` to JobRepository port** — `updateStatus(tenantId, id, status): Promise<Job | null>`
- [x] **2.2: Implement in DrizzleJobRepository**
- [x] **5.1-5.2: Add clientPhone/clientEmail to VisitWithContext** — JOIN clients in listByDateRange and listUnscheduled

## Phase 3: DTO + TransitionVisitStatusUseCase
**Goal:** Status machine, RBAC, race-safe update, best-effort audit, best-effort job auto-derivation.
**Files:** `transition-visit-status-dto.ts` (new), `transition-visit-status.ts` (new)
- [x] **3.1: Create DTOs**
- [x] **3.2: Implement status machine validation** — `getValidTransitions()` and `isValidTransition()` pure functions
- [x] **3.3: Implement TransitionVisitStatusUseCase** — Full use case with RBAC, race guard, audit, job derivation

## Phase 4: Route + Wiring
**Goal:** `PATCH /v1/visits/:id/status` endpoint; wire jobRepo into visit routes.
**Files:** `visit-routes.ts`, `app.ts`
- [x] **4.1: Add jobRepo to buildVisitRoutes**
- [x] **4.2: Add PATCH endpoint** — Body: `z.enum(['en_route', 'started', 'completed', 'cancelled'])`
- [x] **5.3: Update visitWithContextResponseSchema** — Add clientPhone/clientEmail to schema and serializer

## Phase 5: Frontend API Client
**Goal:** Update VisitWithContextResponse and add transitionVisitStatus method.
**Files:** `api-client.ts`
- [x] **5.4: Add clientPhone/clientEmail to frontend type**
- [x] **5.5: Add transitionVisitStatus method** — `PATCH /v1/visits/${id}/status`

## Phase 6-7: TodayPage + Navigation + Routing
**Goal:** Mobile-first `/today` page with visit cards, status action buttons, nav item.
**Files:** `TodayPage.tsx` (new), `App.tsx`, `Sidebar.tsx`
- [x] **6.1: TodayPage shell** — `data-testid="today-page"`, heading + date
- [x] **6.2: Fetch today's visits** — `useQuery(['today-visits', userId, dateStr])`
- [x] **6.3: TodayVisitCard** — Job title, client, status badge, time, duration, address/phone/email links
- [x] **6.4: Status action buttons** — scheduled: En Route + Start; en_route: Start; started: Complete; completed: timestamp
- [x] **6.5: Empty state** — `data-testid="today-empty"`
- [x] **6.6: Error handling** — Mutation error display
- [x] **7.1: Add /today route** in App.tsx
- [x] **7.2: Add Today nav item** — CalendarCheck icon, between Dashboard and Services

## Phase 8: JobDetailPage Status Actions
**Goal:** Visit status transition buttons on job detail page for owner/admin.
**Files:** `JobDetailPage.tsx`
- [x] **8.1: VisitActions component** — Status transition buttons, role-gated to owner/admin
- [x] **8.2: Cancel with confirmation** — Confirmation toggle before cancel

## Phase 9: Unit Tests
**Goal:** 24 unit tests for TransitionVisitStatusUseCase.
**Files:** `transition-visit-status.test.ts` (new), existing test files updated
- [x] **9.1: Status machine tests** (6) — Forward transitions
- [x] **9.2: Job auto-derivation tests** (5) — in_progress, completed, cancelled rules
- [x] **9.3: RBAC tests** (4) — Admin/member/unassigned/cancel
- [x] **9.4: Validation + error tests** (5) — Invalid transitions, not found, conflict
- [x] **9.5: Edge case tests** (2) — Audit/job derivation failure isolation
- [x] **9.6: Pure function tests** (2) — getValidTransitions, isValidTransition
- [x] **9.7: Update existing mocks** — Added updateStatus to all VisitRepository and JobRepository mocks

## Phase 10: Integration Tests
**Goal:** 13 integration tests for status transition endpoint + job auto-derivation.
**Files:** `visit-routes.test.ts`
- [x] **10.1: Status transition route tests** (8) — PATCH with each status, invalid, not found, member RBAC
- [x] **10.2: Job auto-derivation tests** (5) — started->in_progress, all completed, partial, all cancelled, mixed terminal
- [x] **10.3: Context fields assertion** — Updated existing test for clientPhone/clientEmail

## Phase 11: E2E Tests
**Goal:** 7 E2E tests for Today page.
**Files:** `today.spec.ts` (new), `jobs.spec.ts` (updated), `seed.ts` (updated)
- [x] **11.1: Page rendering** — Heading + date
- [x] **11.2: Seeded visit card** — John Smith's Lawn Mowing visit
- [x] **11.3: Address link** — maps.google.com href
- [x] **11.4: Status action buttons** — En Route + Start visible
- [x] **11.5: Full transition flow** — En Route -> Start -> Complete
- [x] **11.6: Navigation** — Today nav link visible and navigates
- [x] **11.7: Accessibility** — axe-core no critical violations
- [x] **11.8: Fix test ordering** — Seeded third visit (John Smith, 2 PM) for isolation from schedule.spec.ts
- [x] **11.9: Fix jobs.spec.ts** — Updated job count assertion (2 -> 3) for new seeded job

## Phase 12: Documentation
**Goal:** Story file, CLAUDE.md updates, domain model doc updates.
**Files:** `S-0015-tech-today-view.md` (new), `CLAUDE.md`, domain model doc
- [x] **12.1: Create story file**
- [x] **12.2: Update CLAUDE.md** — New decisions, patterns, nav order
- [x] **12.3: Update domain model doc** — Visit status transitions, job auto-derivation events, audit catalog

## Test summary
- **Unit**: 276 total (24 new)
- **Integration**: 241 total (13 new)
- **Web unit**: 53 total (0 new)
- **E2E**: 178 total / 115 passed / 63 skipped (7 new tests, 14 new cases counting mobile)
