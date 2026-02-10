# S-0011: Customer Approves Quote

## Status: Complete

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

- [x] **2.1: Update SendQuoteUseCase token scopes**
- [x] **2.2: Expand buildExternalQuoteRoutes deps + add POST routes**
- [x] **2.3: Wire new deps in app.ts**
- [x] **2.4: Update GET response to include approvedAt/declinedAt**
- [x] **2.5: Write integration tests**

## Phase 3: Frontend
**Goal:** Approve/decline buttons on public view, timestamps on internal detail.
**Files:** `api-client.ts` (modify), `PublicQuoteViewPage.tsx` (modify), `QuoteDetailPage.tsx` (modify)

- [x] **3.1: Add API client methods**
- [x] **3.2: Update PublicQuoteViewPage**
- [x] **3.3: Update QuoteDetailPage timestamps**

## Phase 4: Seed Data + E2E Tests + Docs
**Goal:** Update seed, write E2E tests, update all docs.
**Files:** `seed.ts` (modify), `send-quote.spec.ts` (modify), `CLAUDE.md` (modify), context docs

- [x] **4.1: Update seed data**
- [x] **4.2: Write E2E tests**
- [x] **4.3: Update CLAUDE.md + context docs**
- [x] **4.4: Update test counts**
- [x] **4.5: Update story file status**

## Resume context
Story complete. All phases implemented and tested.

## Test summary
- **Unit**: 149 total (12 new)
- **Integration**: 128 total (10 new)
- **E2E**: 88 total (58 run + 30 skipped), 8 new (4 desktop + 4 mobile-skipped)
