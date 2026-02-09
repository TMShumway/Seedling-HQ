# S-003: Service Catalog (Price Book v1)

## Status: In Progress

## Checklist

### Phase 1: Domain + DB Schema
- [ ] Create `ServiceCategory` entity
- [ ] Create `ServiceItem` entity
- [ ] Create `UnitType` type
- [ ] Add `serviceCategories` table to schema
- [ ] Add `serviceItems` table to schema
- [ ] Add seed data for demo tenant
- [ ] Update `reset.ts` to truncate new tables
- [ ] Run `db:push` + `db:seed` — verify

### Phase 2: Application Layer
- [ ] Create `ServiceCategoryRepository` port
- [ ] Create `ServiceItemRepository` port
- [ ] Create service category DTOs
- [ ] Create service item DTOs
- [ ] Create `CreateServiceCategory` use case
- [ ] Create `UpdateServiceCategory` use case
- [ ] Create `DeactivateServiceCategory` use case
- [ ] Create `CreateServiceItem` use case
- [ ] Create `UpdateServiceItem` use case
- [ ] Create `DeactivateServiceItem` use case

### Phase 3: Infrastructure + Backend Tests
- [ ] Create `DrizzleServiceCategoryRepository`
- [ ] Create `DrizzleServiceItemRepository`
- [ ] Unit tests: service category use cases (~6 tests)
- [ ] Unit tests: service item use cases (~6 tests)
- [ ] Integration tests: service category routes (~7 tests)
- [ ] Integration tests: service item routes (~7 tests)
- [ ] Cross-tenant tests (+4 tests)
- [ ] Update integration test `truncateAll`
- [ ] All tests green

### Phase 4: HTTP Routes + Wiring
- [ ] Create service category routes
- [ ] Create service item routes
- [ ] Wire into `app.ts`
- [ ] All tests green

### Phase 5: Frontend API Client + Helpers
- [ ] Add types and methods to `api-client.ts`
- [ ] Create `format.ts` helpers

### Phase 6: Frontend UI Components
- [ ] Create `CategorySection` component
- [ ] Create `ServiceItemRow` component
- [ ] Create `CategoryForm` component
- [ ] Create `ServiceItemForm` component

### Phase 7: Frontend Pages + Routing
- [ ] Create `ServicesPage`
- [ ] Add `/services` route
- [ ] Add sidebar nav item

### Phase 8: E2E Tests
- [ ] Create `services.spec.ts` with CRUD tests
- [ ] Mobile responsive test
- [ ] Accessibility test
- [ ] All tests green

### Phase 9: Final Polish
- [ ] Update this story file
- [ ] Update CLAUDE.md
- [ ] Update MEMORY.md
- [ ] Full test suite green

## Design Decisions
- Price stored as integer cents in DB
- Soft delete via `active` boolean
- Unique constraints: `(tenant_id, name)` for categories, `(tenant_id, category_id, name)` for services
- Unit types: flat, hourly, per_sqft, per_unit, per_visit
- Read operations done directly in route handlers (no use case class)
- Write operations each get their own use case class with audit
