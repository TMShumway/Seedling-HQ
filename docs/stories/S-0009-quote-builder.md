# S-0009: Quote Builder v1

## Status: In Progress

## Overview
First story in the Quotes epic. S-0008 created the `quotes` table and `QuoteRepository` with basic CRUD used by the convert-request flow. This story adds the paginated quotes list page, quote detail/builder page with inline line-item editing, and 4 backend endpoints. After S-0009, users can convert a request and immediately build out the quote with line items and totals.

## Key decisions
- Line item editing: inline editable rows on detail page (no modal)
- Tax handling: manual fixed-cents entry (no automatic rate for MVP)
- Service item picker: optional dropdown from catalog (serviceItemId already nullable)
- Edit guard: only `draft` quotes editable (PUT returns 400 otherwise)
- Client/property display: read-only on quote detail
- Search: ILIKE on `title` only
- UpdateQuoteUseCase atomicity: no UoW (direct repo + best-effort audit), follows UpdateClientUseCase pattern
- Convert redirect: changed to `/quotes/:id` (deferred from S-0008)

## Phase 1: Backend — Repository + Use Case
**Goal:** Extend QuoteRepository with `list`/`update`, create UpdateQuoteUseCase, add event label.

- [ ] **1.1: Extend QuoteRepository port** — add list + update
- [ ] **1.2: Implement list/update in DrizzleQuoteRepository**
- [ ] **1.3: Create quote-dto.ts**
- [ ] **1.4: Create UpdateQuoteUseCase**
- [ ] **1.5: Add `quote.updated` event label**

## Phase 2: Backend — Routes + Wiring
**Goal:** Create quote-routes.ts with 4 endpoints, wire in app.ts.

- [ ] **2.1: Create quote-routes.ts** — GET list, GET count, GET detail, PUT update
- [ ] **2.2: Wire in app.ts**

## Phase 3: Backend Tests
**Goal:** Unit tests for UpdateQuoteUseCase, integration tests for all 4 routes.

- [ ] **3.1: Unit tests for UpdateQuoteUseCase (~13 tests)**
- [ ] **3.2: Integration tests for quote routes (~12 tests)**

## Phase 4: Frontend — Pages + Navigation
**Goal:** API client methods, QuotesPage list, QuoteDetailPage with line-item builder, sidebar + routes.

- [ ] **4.1: Extend api-client.ts**
- [ ] **4.2: Create QuotesPage.tsx**
- [ ] **4.3: Create QuoteDetailPage.tsx with line item builder**
- [ ] **4.4: Enable sidebar + add routes**

## Phase 5: E2E Tests + Polish
**Goal:** E2E tests, convert redirect update, seed data, accessibility.

- [ ] **5.1: Add seed quote data**
- [ ] **5.2: Update ConvertRequestPage redirect**
- [ ] **5.3: E2E tests for quotes (~4 tests)**

## Phase 6: Doc Updates
- [ ] **6.1: Update CLAUDE.md**

## Resume context
### Last completed
- (starting fresh)
### In progress
- Phase 1 implementation
### Next up
- Task 1.1: Extend QuoteRepository port
### Blockers / open questions
- None

## Test summary
- **Unit**: 100 total (0 new)
- **Integration**: 91 total (0 new)
- **E2E**: 62 total (0 new)
