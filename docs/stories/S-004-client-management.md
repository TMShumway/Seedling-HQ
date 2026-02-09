# S-004: Client + Property Management

## Phase 1: Story File + DB Schema
- [x] Create story file
- [x] Add `clients` table to schema
- [x] Add `properties` table to schema
- [x] Update `reset.ts` TRUNCATE order
- [x] Update integration `setup.ts` TRUNCATE order
- [ ] Run `db:push` (DB not running — apply when starting docker-compose)

## Phase 2: Domain Layer
- [x] Create `client.ts` entity
- [x] Create `property.ts` entity

## Phase 3: Application Layer (Ports + DTOs)
- [x] Create `client-repository.ts` port (with `PaginatedResult`, `ListClientsFilters`)
- [x] Create `property-repository.ts` port
- [x] Create `client-dto.ts`
- [x] Create `property-dto.ts`

## Phase 4: Unit Tests (TDD)
- [x] Create `client.test.ts` (8 tests) — all passing
- [x] Create `property.test.ts` (7 tests) — all passing

## Phase 5: Use Cases
- [x] `create-client.ts`
- [x] `update-client.ts`
- [x] `deactivate-client.ts`
- [x] `create-property.ts`
- [x] `update-property.ts`
- [x] `deactivate-property.ts`

## Phase 6: Infrastructure (Drizzle Repos)
- [x] `drizzle-client-repository.ts` (with cursor pagination + search)
- [x] `drizzle-property-repository.ts`

## Phase 7: HTTP Routes
- [x] `client-routes.ts`
- [x] `property-routes.ts`
- [x] Register in `app.ts`

## Phase 8: Integration Tests
- [x] `client-routes.test.ts` (15 tests)
- [x] `property-routes.test.ts` (8 tests)
- [x] Add cross-tenant tests (4 tests)

## Phase 9: Seed Data
- [x] Add demo clients + properties to `seed.ts`

## Phase 10: Frontend API Client
- [x] Add types + methods to `api-client.ts`
- [x] Add `formatAddress()`, `formatClientName()` to `format.ts`

## Phase 11: Frontend Pages + Components
- [x] `ClientsPage.tsx` (list + search + pagination)
- [x] `ClientDetailPage.tsx`
- [x] `ClientForm.tsx`
- [x] `ClientCard.tsx`
- [x] `PropertyForm.tsx`
- [x] `PropertyRow.tsx`

## Phase 12: Routing + Nav
- [x] Add routes to `App.tsx`
- [x] Update Sidebar nav

## Phase 13: E2E Tests
- [x] `clients.spec.ts`

## Phase 14: Dashboard + Documentation
- [x] Dashboard client count card
- [x] Update CLAUDE.md

## Verification
- [x] Frontend builds cleanly
- [x] All 56 unit tests pass (41 existing + 15 new)
- [ ] Integration tests (requires DB)
- [ ] E2E tests (requires DB + dev server)
- [ ] `db:push` schema applied
