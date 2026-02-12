# S-0012: Create Job + First Visit from Approved Quote

## Status: Complete

## Overview
Introduces the **Job** and **Visit** domain entities and the workflow to create them from an approved quote. The owner clicks "Create Job" on an approved quote, which atomically creates a Job + first Visit and transitions the quote to `scheduled`. The Jobs nav item is enabled with a list page and detail page.

## Key decisions
- Decision: Create job endpoint — Chosen: `POST /v1/jobs` with `{ quoteId }` body — Why: Keeps all job routes in `job-routes.ts`; follows standalone creation pattern
- Decision: Job-to-Quote cardinality — Chosen: 1:1 via unique constraint `(tenant_id, quote_id)` — Why: Prevents duplicate jobs for same quote
- Decision: Idempotency — Chosen: Pre-check (status=scheduled → lookup) + catch unique violation → scoped lookup — Why: Handles both status-based and race-condition idempotency
- Decision: Quote status extension — Chosen: Add `'scheduled'` + `scheduledAt` to QuoteStatus — Why: Analytics granularity and clean status machine progression
- Decision: Visit duration storage — Chosen: `estimatedDurationMinutes` from service item sum, default 60 — Why: Decoupled from service item changes after creation
- Decision: Visit time fields — Chosen: Nullable `timestamp with timezone` for `scheduledStart`/`scheduledEnd` — Why: Enables S-0013 calendar range queries naturally
- Decision: Job detail visits — Chosen: Embedded in `GET /v1/jobs/:id` response — Why: Visits per job are few; avoids extra round-trip
- Decision: Quote-to-Job navigation — Chosen: `GET /v1/jobs/by-quote/:quoteId` endpoint — Why: Deterministic navigation from scheduled quote to its job

## Phase 1: Domain + Schema
**Goal:** Define Job and Visit entities, extend QuoteStatus, add DB tables.
- [x] Create Job entity + status type
- [x] Create Visit entity + status type
- [x] Extend QuoteStatus with `'scheduled'` + `scheduledAt`
- [x] Add `jobs` and `visits` tables to schema
- [x] Update `truncateAll` for FK order

## Phase 2: Repository Layer + UoW
**Goal:** Create Job/Visit repository ports and Drizzle implementations.
- [x] Create JobRepository port
- [x] Create VisitRepository port
- [x] Implement DrizzleJobRepository with pagination/search/filter
- [x] Implement DrizzleVisitRepository
- [x] Update UoW with jobRepo + visitRepo
- [x] Update QuoteRepository for scheduledAt
- [x] Update existing test mocks

## Phase 3: Use Case + Routes + Cross-Cutting
**Goal:** Implement CreateJobFromQuoteUseCase, build job routes, handle scheduled status impacts.
- [x] Create CreateJobFromQuoteInput/Output DTOs
- [x] Implement CreateJobFromQuoteUseCase (atomic UoW + idempotency)
- [x] Build job-routes.ts (5 endpoints: list, count, by-quote, create, getById)
- [x] Wire into app.ts
- [x] Update RespondToQuoteUseCase for scheduled idempotency

## Phase 4: Seed Data + Quote UI Updates
**Goal:** Add seed data, update quote UI for scheduled status.
- [x] Seed approved quote + scheduled quote with job/visit
- [x] Update QuotesPage with Scheduled filter/badge
- [x] Update QuoteDetailPage with Create Job button + View Job link
- [x] Fix PublicQuoteViewPage for scheduled status
- [x] Add API client methods (createJobFromQuote, getJobByQuoteId, etc.)

## Phase 5: Frontend Jobs Pages + Navigation
**Goal:** Enable Jobs nav, build list + detail pages.
- [x] Add Job/Visit API client types + methods
- [x] Enable Jobs nav + add routes
- [x] Build JobsPage (filter pills, search, infinite query)
- [x] Build JobDetailPage (client/property/quote cards, visits section)

## Phase 6: Tests
**Goal:** Unit, integration, E2E coverage.
- [x] 14 unit tests for CreateJobFromQuoteUseCase
- [x] 1 unit test added to RespondToQuoteUseCase (scheduled idempotency)
- [x] 14 integration tests for job routes
- [x] 6 E2E tests (list, filter, detail, create-job-from-quote, a11y)

## Phase 7: Documentation
**Goal:** Update story file, CLAUDE.md, domain model doc.
- [x] Create story file
- [x] Update CLAUDE.md
- [x] Update domain model doc

## Test summary
- **Unit**: 229 total (15 new — 14 CreateJobFromQuoteUseCase + 1 RespondToQuoteUseCase)
- **Integration**: 199 total (14 new)
- **Web unit**: 53 total (0 new)
- **E2E**: 140 total (12 new — 6 desktop + 6 mobile)
