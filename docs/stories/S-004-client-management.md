# S-004: Client + Property Management

## Phase 1: Story File + DB Schema
- [x] Create story file
- [x] Add `clients` table to schema
- [x] Add `properties` table to schema
- [x] Update `reset.ts` TRUNCATE order
- [x] Update integration `setup.ts` TRUNCATE order
- [x] Run `db:push`

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

## Phase 15: USWDS-Inspired Professional Reskin
- [x] New color palette: deep navy primary (`#1e3a5f`), slate background, stronger borders
- [x] Dark sidebar (slate-900) with blue-400 active highlight and left border accent
- [x] Tighter border radii (2/4/6/8px) for crisper look
- [x] Stronger focus indicators (`ring-2` + `ring-offset-2`) on buttons and form controls
- [x] Deeper dashboard accent colors (sky/blue/teal replacing pastel indigo/violet/emerald)
- [x] Plain-text welcome header (removed gradient banner), tighter spacing
- [x] Rename branding to "Seedling HQ" across sidebar, topbar, mobile drawer
- [x] Updated UI/UX context pack, S-002 story notes, CLAUDE.md design decisions

## Phase 16: PR Feedback Fixes
- [x] Add post-trim validation in `UpdateClientUseCase` (reject whitespace-only `firstName`/`lastName`)
- [x] Add post-trim validation in `UpdatePropertyUseCase` (reject whitespace-only `addressLine1`)
- [x] Add 3 unit tests for whitespace-only update rejection

## Verification
- [x] Frontend builds cleanly
- [x] All 59 unit tests pass (41 existing + 15 S-004 + 3 PR feedback)
- [x] Integration tests — 61 passing (including 27 new client/property + 4 cross-tenant)
- [x] E2E tests — 32 passing, 12 skipped (non-desktop-chrome)
- [x] `db:push` schema applied
