# S-005: Client Timeline (Activity Feed v1)

> Issue #19: "As an owner, I can see a timeline of quotes/jobs/invoices per client."
> v1 shows client + property audit events. Future stories expand with quote/job/invoice events.
> Client detail page reorganized into a tab layout (Info / Properties / Activity).

## Checklist

### Phase 1: DB + Story
- [x] Create story checklist (this file)
- [x] Add composite index on `audit_events` for timeline queries
- [x] Run `db:push` to apply index

### Phase 2: Backend — Repository + Route
- [x] Extend `AuditEventRepository` port with `listBySubjects` method
- [x] Implement `listBySubjects` in `DrizzleAuditEventRepository`
- [x] Create timeline DTO (`TimelineEvent`)
- [x] Add `GET /v1/clients/:clientId/timeline` route
- [x] Map event names to human-readable labels

### Phase 3: Backend Tests
- [x] Unit tests — `getEventLabel` (8 tests)
- [x] Integration tests — timeline newest-first, pagination, cross-tenant, exclude filter, 404, empty (6 tests)

### Phase 4: Seed Data
- [x] Add `client.created` audit events for demo clients
- [x] Add `property.created` audit events for demo properties

### Phase 5: Frontend — Tab Layout
- [x] Refactor `ClientDetailPage` to Info / Properties / Activity tabs
- [x] Move client info to Info tab
- [x] Move properties to Properties tab

### Phase 6: Frontend — Timeline Component
- [x] Create `TimelineSection` component
- [x] Add timeline types + method to `api-client.ts`
- [x] Infinite scroll with "Load More"
- [x] Event icons (Lucide)
- [x] Relative timestamps helper
- [x] Toggle to hide deactivation events
- [x] Loading skeleton + empty state

### Phase 7: E2E Tests
- [x] Navigate to Activity tab, verify events from seed data (3 tests)
- [x] Verify tab switching works
- [x] Toggle deactivation filter
- [x] Updated existing client E2E tests for tab layout

### Phase 8: Documentation
- [x] Update `CLAUDE.md` — tab layout + timeline patterns
- [x] Update `MEMORY.md` — test counts
- [x] Check off all items in this file
