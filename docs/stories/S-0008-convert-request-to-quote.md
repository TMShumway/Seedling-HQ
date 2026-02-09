# S-0008: Convert Request to Client + Quote Draft

## Status: In Progress

## Checklist

### Phase 1: Domain entity + schema
- [ ] Create `quote.ts` domain entity
- [ ] Add `quotes` table to `schema.ts`
- [ ] Add `quotes` to `reset.ts` TRUNCATE
- [ ] Add `quotes` to integration `setup.ts` TRUNCATE
- [ ] Run `db:push` successfully

### Phase 2: Ports + repository + UoW extension
- [ ] Create `QuoteRepository` port
- [ ] Create `ConvertRequestDTO`
- [ ] Create `DrizzleQuoteRepository`
- [ ] Add `updateStatus()` to `RequestRepository` port
- [ ] Implement `updateStatus()` in `DrizzleRequestRepository`
- [ ] Extend `TransactionRepos` with `clientRepo`, `propertyRepo`, `requestRepo`, `quoteRepo`
- [ ] Update `DrizzleUnitOfWork` with new repos
- [ ] Update `create-tenant.test.ts` UoW mock

### Phase 3: Use case (TDD)
- [ ] Write unit tests (~13 cases)
- [ ] Implement `ConvertRequestUseCase`
- [ ] All unit tests pass

### Phase 4: Route + app wiring + integration tests
- [ ] Add `POST /v1/requests/:id/convert` route
- [ ] Wire deps in `app.ts`
- [ ] Write integration tests (~7 cases)
- [ ] All integration tests pass

### Phase 5: Frontend
- [ ] Add `QuoteResponse`, `ConvertRequestPayload`, `ConvertRequestResponse` to api-client
- [ ] Add `apiClient.convertRequest()` method
- [ ] Create `RequestDetailPage.tsx`
- [ ] Create `ConvertRequestPage.tsx`
- [ ] Add routes to `App.tsx`
- [ ] Make request cards clickable in `RequestsPage.tsx`

### Phase 6: E2E tests
- [ ] Write convert request flow E2E test
- [ ] Write already-converted state test
- [ ] Write accessibility test
- [ ] All E2E tests pass

### Phase 7: Documentation
- [ ] Update `CLAUDE.md`
- [ ] Update domain model doc
- [ ] Update data access doc
- [ ] Update API standards doc
- [ ] Update UI/UX doc
- [ ] Update timeline-dto event labels
