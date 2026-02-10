# S-0026: Create Standalone Quote (No Request Required)

## Status: In Progress

## Overview
Quotes can currently only be created via the request-conversion flow (S-0008 `ConvertRequestUseCase`). S-0026 adds a direct `POST /v1/quotes` endpoint and a "New Quote" button on `QuotesPage` so owners can create draft quotes for existing clients without needing a service request first. The DB schema already supports this — `requestId` and `propertyId` are nullable on the `quotes` table.

## Key decisions
- Decision: Use case vs direct route — Chosen: `CreateStandaloneQuoteUseCase` — Why: Cross-entity validation (client/property) is business logic; enables TDD
- Decision: UoW — Chosen: Not needed — Why: Single entity write + best-effort audit (matches `UpdateQuoteUseCase`)
- Decision: Input fields — Chosen: `clientId` (required), `propertyId` (optional), `title` (required) — Why: Line items/tax added later via existing `PUT /v1/quotes/:id` on QuoteDetailPage
- Decision: Property validation — Chosen: Must belong to specified client + be active — Why: Prevents data integrity issues
- Decision: Client validation — Chosen: Must exist in same tenant + be active — Why: Prevents quotes for deactivated clients
- Decision: Frontend route — Chosen: `/quotes/new` before `/:id` — Why: Avoids route collision
- Decision: New dep injection — Chosen: Add `propertyRepo` to `buildQuoteRoutes` — Why: Not currently passed; needed for property validation

## Phase 0: Story File
- [x] **0.1: Create `docs/stories/S-0026-create-standalone-quote.md`**

## Phase 1: DTO + Use Case (TDD)
**Goal:** Create `CreateStandaloneQuoteUseCase` with full unit test coverage.
**Files:** `apps/api/src/application/dto/quote-dto.ts`, `apps/api/src/application/usecases/create-quote.ts` (new), `apps/api/test/unit/create-quote.test.ts` (new)

- [x] **1.1: Add CreateStandaloneQuoteInput to quote-dto.ts**
  - `CreateStandaloneQuoteInput`: `{ tenantId, userId, clientId, propertyId?, title }`
  - Acceptance: DTO compiles with no errors

- [x] **1.2: Write unit tests first (RED)**
  - 11 tests: happy path (with/without property), title trim, title validation, client not found, inactive client, property not found, inactive property, property-client mismatch, audit event fields, no propertyRepo call when no propertyId
  - Acceptance: Tests written and all pass

- [x] **1.3: Implement CreateStandaloneQuoteUseCase (GREEN)**
  - Constructor: `(quoteRepo, clientRepo, propertyRepo, auditRepo)`
  - Validate title (trim, non-empty), client (exists, active, same tenant), property (if provided: exists, active, belongs to client)
  - Create quote: `requestId: null`, `lineItems: []`, `subtotal/tax/total: 0`, `status: 'draft'`
  - Best-effort audit: `quote.created`, `principalType: 'internal'`, `principalId: userId`
  - Acceptance: All 11 unit tests pass

## Phase 2: API Route + Integration Tests
**Goal:** Wire `POST /v1/quotes` and add integration tests.
**Files:** `apps/api/src/adapters/http/routes/quote-routes.ts`, `apps/api/src/app.ts`, `apps/api/test/integration/quote-routes.test.ts`

- [x] **2.1: Add `propertyRepo` to quote route deps**
  - Acceptance: TypeScript compiles with no errors

- [x] **2.2: Add POST /v1/quotes route**
  - Zod schema: `{ clientId: uuid, propertyId?: uuid | null, title: string min(1) max(500) }`
  - Response: 201 with serialized quote
  - Acceptance: Route compiles

- [x] **2.3: Write integration tests (9 tests)**
  - Happy path (with/without property), 404 client, 404 property, 400 property-client mismatch, 400 empty title, 400 missing clientId, appears in GET list, cross-tenant isolation
  - Acceptance: All 137 integration tests pass (9 new)

## Phase 3: Frontend
**Goal:** New Quote button on QuotesPage, CreateQuotePage with client search.
**Files:** `apps/web/src/lib/api-client.ts`, `apps/web/src/pages/CreateQuotePage.tsx` (new), `apps/web/src/App.tsx`, `apps/web/src/pages/QuotesPage.tsx`

- [ ] **3.1: Add createQuote to api-client.ts**
  - Acceptance: TypeScript compiles

- [ ] **3.2: Create CreateQuotePage**
  - Client search: debounced 300ms input → radio buttons
  - Property dropdown: enabled when client selected
  - Title input: auto-suggest on client selection
  - Submit: redirect to `/quotes/${result.id}`
  - Acceptance: Page renders and creates quotes

- [ ] **3.3: Add route + button**
  - App.tsx: `/quotes/new` route BEFORE `/quotes/:id`
  - QuotesPage: "New Quote" button in header
  - Acceptance: Navigation works end-to-end

## Phase 4: E2E Tests + Docs
**Goal:** E2E tests, update docs.
**Files:** `e2e/quotes.spec.ts`, story file, CLAUDE.md

- [ ] **4.1: Write E2E tests**
  - Navigate to create page via "New Quote" button
  - Search for seeded client, select, verify property dropdown
  - Create quote with title, verify redirect to QuoteDetailPage
  - Verify new quote appears in quotes list
  - Acceptance: All E2E tests pass

- [ ] **4.2: Update CLAUDE.md**
  - Add key decision + backend/frontend pattern entries for S-0026
  - Acceptance: CLAUDE.md updated

- [ ] **4.3: Update story file status**
  - Acceptance: Status set to Complete

## Resume context
### Last completed
- Phase 2: API Route + Integration Tests — all 137 integration tests pass
  - `apps/api/src/adapters/http/routes/quote-routes.ts` — added POST /v1/quotes route + propertyRepo dep
  - `apps/api/src/app.ts` — pass propertyRepo to buildQuoteRoutes
  - `apps/api/test/integration/quote-routes.test.ts` — 9 new integration tests
### In progress
- Starting Phase 3: Frontend
### Next up
- Task 3.1: Add createQuote to api-client.ts
### Blockers / open questions
- None

## Test summary
- **Unit**: 162 total (11 new)
- **Integration**: 137 total (9 new)
- **E2E**: 88 total (0 new)
