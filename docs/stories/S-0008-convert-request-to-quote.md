# S-0008: Convert Request to Client + Quote Draft

## Status: Complete

## Checklist

### Phase 1: Domain entity + schema
- [x] Create `quote.ts` domain entity
- [x] Add `quotes` table to `schema.ts`
- [x] Add `quotes` to `reset.ts` TRUNCATE
- [x] Add `quotes` to integration `setup.ts` TRUNCATE
- [x] Run `db:push` successfully

### Phase 2: Ports + repository + UoW extension
- [x] Create `QuoteRepository` port
- [x] Create `ConvertRequestDTO`
- [x] Create `DrizzleQuoteRepository`
- [x] Add `updateStatus()` to `RequestRepository` port
- [x] Implement `updateStatus()` in `DrizzleRequestRepository`
- [x] Extend `TransactionRepos` with `clientRepo`, `propertyRepo`, `requestRepo`, `quoteRepo`
- [x] Update `DrizzleUnitOfWork` with new repos
- [x] Update `create-tenant.test.ts` UoW mock

### Phase 3: Use case (TDD)
- [x] Write unit tests (~13 cases)
- [x] Implement `ConvertRequestUseCase`
- [x] All unit tests pass (99 total)

### Phase 4: Route + app wiring + integration tests
- [x] Add `POST /v1/requests/:id/convert` route
- [x] Wire deps in `app.ts`
- [x] Write integration tests (~7 cases)
- [x] All integration tests pass (91 total)

### Phase 5: Frontend
- [x] Add `QuoteResponse`, `ConvertRequestPayload`, `ConvertRequestResponse` to api-client
- [x] Add `apiClient.convertRequest()` method
- [x] Create `RequestDetailPage.tsx`
- [x] Create `ConvertRequestPage.tsx`
- [x] Add routes to `App.tsx`
- [x] Make request cards clickable in `RequestsPage.tsx`

### Phase 6: E2E tests
- [x] Write convert request flow E2E test
- [x] Write already-converted state test
- [x] Write accessibility test
- [x] All E2E tests pass (43 total)

### Phase 7: Documentation
- [x] Update timeline-dto event labels
- [x] Update `CLAUDE.md`
- [x] Update domain model doc
- [x] Update data access doc
- [x] Update API standards doc
- [x] Update UI/UX doc
