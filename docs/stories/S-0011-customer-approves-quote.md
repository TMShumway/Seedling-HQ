# S-0011: Customer Approves Quote

## Status: In Progress

## Overview
Add "Approve" and "Decline" buttons to the public quote view page so clients can respond via the same secure link. The owner sees the updated status in internal quotes list/detail pages and receives a notification email.

## Key decisions
- Decision: Scope strategy — Chosen: Add `quote:respond` to existing token — Why: Same link for view + respond; no new tokens needed
- Decision: Use case pattern — Chosen: `RespondToQuoteUseCase` (single class) — Why: Approve/decline share identical logic; parameterized by `action`
- Decision: UoW — Chosen: Not needed — Why: Single entity write + best-effort audit + best-effort notification
- Decision: Status guard — Chosen: Only `sent` → `approved`/`declined` — Why: Domain model spec
- Decision: Idempotency — Chosen: Same-action repeat → 200 (no-op), cross-transition → 400 — Why: Client may double-click
- Decision: External principal — Chosen: `principalType: 'external'`, `principalId: tokenId` — Why: Distinguishes from internal/system
- Decision: Endpoint prefix — Chosen: `POST /v1/ext/quotes/:token/approve` and `/decline` — Why: Extends existing external routes
- Decision: Decline confirmation — Chosen: State-based dialog — Why: Matches existing `showSendConfirm` pattern

## Phase 0: Story File
- [x] **0.1: Create story file**

## Phase 1: DTO + Use Case (TDD)
**Goal:** Create `RespondToQuoteUseCase` with full test coverage.
**Files:** `respond-quote-dto.ts` (new), `respond-to-quote.ts` (new), `timeline-dto.ts` (modify), `respond-to-quote.test.ts` (new)

- [x] **1.1: Create respond-quote-dto.ts**
- [x] **1.2: Write unit tests first (RED)**
- [x] **1.3: Implement RespondToQuoteUseCase (GREEN)**
- [x] **1.4: Add event labels to timeline-dto.ts**

## Phase 2: API Routes + Integration Tests
**Goal:** Wire use case into external routes, update token scopes.
**Files:** `send-quote.ts` (modify scopes), `external-quote-routes.ts` (modify), `app.ts` (modify), `send-quote.test.ts` (modify), `send-quote-routes.test.ts` (modify)

- [ ] **2.1: Update SendQuoteUseCase token scopes**
- [ ] **2.2: Expand buildExternalQuoteRoutes deps + add POST routes**
- [ ] **2.3: Wire new deps in app.ts**
- [ ] **2.4: Update GET response to include approvedAt/declinedAt**
- [ ] **2.5: Write integration tests**

## Phase 3: Frontend
**Goal:** Approve/decline buttons on public view, timestamps on internal detail.
**Files:** `api-client.ts` (modify), `PublicQuoteViewPage.tsx` (modify), `QuoteDetailPage.tsx` (modify)

- [ ] **3.1: Add API client methods**
- [ ] **3.2: Update PublicQuoteViewPage**
- [ ] **3.3: Update QuoteDetailPage timestamps**

## Phase 4: Seed Data + E2E Tests + Docs
**Goal:** Update seed, write E2E tests, update all docs.
**Files:** `seed.ts` (modify), `send-quote.spec.ts` (modify), `CLAUDE.md` (modify), context docs

- [ ] **4.1: Update seed data**
- [ ] **4.2: Write E2E tests**
- [ ] **4.3: Update CLAUDE.md + context docs**
- [ ] **4.4: Update README and test counts**
- [ ] **4.5: Update story file status**

## Resume context
### Last completed
- Phase 1: DTO + Use Case (TDD) — all 4 tasks complete
  - `apps/api/src/application/dto/respond-quote-dto.ts` (new)
  - `apps/api/src/application/usecases/respond-to-quote.ts` (new)
  - `apps/api/src/application/dto/timeline-dto.ts` (added 2 event labels)
  - `apps/api/test/unit/respond-to-quote.test.ts` (12 new tests, all GREEN)
### In progress
- Starting Phase 2
### Next up
- Task 2.1: Update SendQuoteUseCase token scopes
### Blockers / open questions
- None

## Test summary
- **Unit**: 149 total (12 new)
- **Integration**: 0 new
- **E2E**: 0 new
