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

**Files touched:**
- `apps/api/src/application/ports/quote-repository.ts` — added `ListQuotesFilters`, `QuoteUpdatePatch`, `list()`, `update()`
- `apps/api/src/infra/db/repositories/drizzle-quote-repository.ts` — implemented `list()` (cursor pagination, status/search filters) and `update()`
- `apps/api/src/application/dto/quote-dto.ts` — created `UpdateQuoteInput`, `QuoteOutput`
- `apps/api/src/application/usecases/update-quote.ts` — created with draft guard, line item validation, total recomputation, audit
- `apps/api/src/application/dto/timeline-dto.ts` — added `quote.updated` label

- [x] **1.1: Extend QuoteRepository port** — add list + update
- [x] **1.2: Implement list/update in DrizzleQuoteRepository**
- [x] **1.3: Create quote-dto.ts**
- [x] **1.4: Create UpdateQuoteUseCase**
- [x] **1.5: Add `quote.updated` event label**

## Phase 2: Backend — Routes + Wiring
**Goal:** Create quote-routes.ts with 4 endpoints, wire in app.ts.

**Files touched:**
- `apps/api/src/adapters/http/routes/quote-routes.ts` — created with GET list, GET count, GET /:id, PUT /:id
- `apps/api/src/app.ts` — imported DrizzleQuoteRepository + buildQuoteRoutes, instantiated quoteRepo, registered routes

- [x] **2.1: Create quote-routes.ts** — GET list, GET count, GET detail, PUT update
- [x] **2.2: Wire in app.ts**

## Phase 3: Backend Tests
**Goal:** Unit tests for UpdateQuoteUseCase, integration tests for all 4 routes.

**Files touched:**
- `apps/api/test/unit/update-quote.test.ts` — 14 unit tests (happy path, calculations, validations, audit)
- `apps/api/test/integration/quote-routes.test.ts` — 13 integration tests (CRUD, filters, cross-tenant isolation)

- [x] **3.1: Unit tests for UpdateQuoteUseCase (14 tests)** — all passing
- [x] **3.2: Integration tests for quote routes (13 tests)** — all passing

## Phase 4: Frontend — Pages + Navigation
**Goal:** API client methods, QuotesPage list, QuoteDetailPage with line-item builder, sidebar + routes.

**Files touched:**
- `apps/web/src/lib/api-client.ts` — added `QuoteLineItemResponse`, `UpdateQuoteRequest`, `listQuotes()`, `getQuote()`, `updateQuote()`, `countQuotes()`
- `apps/web/src/pages/QuotesPage.tsx` — paginated list with status filter pills, debounced search, empty state
- `apps/web/src/pages/QuoteDetailPage.tsx` — inline line-item builder, client/property/request info cards, save flow
- `apps/web/src/components/quotes/LineItemRow.tsx` — editable row with description, qty, price, remove
- `apps/web/src/components/quotes/ServiceItemPicker.tsx` — dropdown grouped by category, auto-fills on select
- `apps/web/src/app-shell/Sidebar.tsx` — Quotes nav item enabled (`href: '/quotes'`, `active: true`)
- `apps/web/src/App.tsx` — added `/quotes` and `/quotes/:id` routes

- [x] **4.1: Extend api-client.ts**
- [x] **4.2: Create QuotesPage.tsx**
- [x] **4.3: Create QuoteDetailPage.tsx with line item builder**
- [x] **4.4: Enable sidebar + add routes**

## Phase 5: E2E Tests + Polish
**Goal:** E2E tests, convert redirect update, seed data, accessibility.

**Files touched:**
- `apps/api/src/infra/db/seed.ts` — added demo quote (ID `...0700`) with 2 line items, linked to johnSmith client + quote.created audit event
- `apps/web/src/pages/ConvertRequestPage.tsx` — changed redirect from `/clients/:id` to `/quotes/:id`
- `e2e/tests/quotes.spec.ts` — created: 3 desktop tests + 1 a11y test (3 skipped non-desktop)
- `e2e/tests/convert-request.spec.ts` — updated redirect assertion to expect `quote-detail-page` + `quote-title-input` value

- [x] **5.1: Add seed quote data**
  - Acceptance: `db:seed` creates quote visible in /quotes list
- [x] **5.2: Update ConvertRequestPage redirect**
  - Acceptance: convert flow lands on `/quotes/:id` instead of `/clients/:id`
- [x] **5.3: E2E tests for quotes (5 run, 3 skipped)**
  - Acceptance: `pnpm --filter e2e test` all pass (48 passed, 22 skipped)

## Phase 6: Doc Updates
- [ ] **6.1: Update CLAUDE.md**

## Resume context
### Last completed
- Phase 5 complete: seed data, convert redirect, E2E tests all passing
- Commits: `d725c10` (phases 1-3), `3de1db9` (phase 4)
### In progress
- Nothing — about to commit phase 5, then start Phase 6
### Next up
- Task 6.1: Update CLAUDE.md
### Blockers / open questions
- None

## Test summary
- **Unit**: 114 total (14 new in update-quote.test.ts)
- **Integration**: 104 total (13 new in quote-routes.test.ts)
- **E2E**: 70 total (8 new in quotes.spec.ts — 5 run + 3 skipped non-desktop), 48 passed + 22 skipped overall
