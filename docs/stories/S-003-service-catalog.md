# S-003: Service Catalog (Price Book v1)

## Status: Complete

## Checklist

### Phase 1: Domain + DB Schema
- [x] Create `ServiceCategory` entity
- [x] Create `ServiceItem` entity
- [x] Create `UnitType` type
- [x] Add `serviceCategories` table to schema
- [x] Add `serviceItems` table to schema
- [x] Add seed data for demo tenant
- [x] Update `reset.ts` to truncate new tables
- [x] Run `db:push` + `db:seed` — verify

### Phase 2: Application Layer
- [x] Create `ServiceCategoryRepository` port
- [x] Create `ServiceItemRepository` port
- [x] Create service category DTOs
- [x] Create service item DTOs
- [x] Create `CreateServiceCategory` use case
- [x] Create `UpdateServiceCategory` use case
- [x] Create `DeactivateServiceCategory` use case
- [x] Create `CreateServiceItem` use case
- [x] Create `UpdateServiceItem` use case
- [x] Create `DeactivateServiceItem` use case

### Phase 3: Infrastructure + Backend Tests
- [x] Create `DrizzleServiceCategoryRepository`
- [x] Create `DrizzleServiceItemRepository`
- [x] Unit tests: service category use cases (7 tests)
- [x] Unit tests: service item use cases (7 tests)
- [x] Integration tests: service category routes (9 tests)
- [x] Integration tests: service item routes (8 tests)
- [x] Cross-tenant tests (+4 tests)
- [x] Update integration test `truncateAll`
- [x] All tests green

### Phase 4: HTTP Routes + Wiring
- [x] Create service category routes
- [x] Create service item routes
- [x] Wire into `app.ts`
- [x] All tests green

### Phase 5: Frontend API Client + Helpers
- [x] Add types and methods to `api-client.ts`
- [x] Create `format.ts` helpers

### Phase 6: Frontend UI Components
- [x] Create `CategorySection` component
- [x] Create `ServiceItemRow` component
- [x] Create `CategoryForm` component
- [x] Create `ServiceItemForm` component

### Phase 7: Frontend Pages + Routing
- [x] Create `ServicesPage`
- [x] Add `/services` route
- [x] Add sidebar nav item

### Phase 8: E2E Tests
- [x] Create `services.spec.ts` with CRUD tests
- [x] Mobile responsive test
- [x] Accessibility test
- [x] All tests green

### Phase 9: Final Polish
- [x] Update this story file
- [x] Update CLAUDE.md
- [x] Update MEMORY.md
- [x] Full test suite green

## Test Counts

| Suite | Count |
|-------|-------|
| Unit | 41 |
| Integration | 37 |
| E2E (total) | 30 (23 run + 7 skipped) |
| **Total** | **108** |

## Design Decisions
- Price stored as integer cents in DB
- Soft delete via `active` boolean — cascades to child service items when category is deactivated
- Unique constraints: `(tenant_id, name)` for categories, `(tenant_id, category_id, name)` for services
- Unit types: flat, hourly, per_sqft, per_unit, per_visit
- Read operations done directly in route handlers (no use case class)
- Write operations each get their own use case class with audit
- Dollar input in UI → cents conversion in frontend before API call
- 204 response handling added to frontend API client for DELETE endpoints
