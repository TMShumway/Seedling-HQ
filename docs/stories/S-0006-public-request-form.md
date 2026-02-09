# S-0006: Public "Request Service" Form

## Acceptance Criteria
- External customer can submit a service request via public form (no auth required)
- Request record is created, tenant-scoped via slug
- Confirmation page shown after submission
- Honeypot field + per-IP rate limit for spam protection
- Request appears in authenticated owner list

## Checklist

### Backend
- [x] Domain entity: `Request` interface + types
- [x] DB schema: `requests` table with indexes
- [x] Repository port: `RequestRepository`
- [x] Drizzle repository implementation
- [x] DTOs: `CreatePublicRequestInput`, `RequestOutput`
- [x] Use case: `CreatePublicRequestUseCase` (TDD)
- [x] Rate limit middleware (in-memory sliding window)
- [x] Routes: public POST + authenticated GET list/count/by-id
- [x] Register in app.ts
- [x] Seed data: 3 demo requests + audit events
- [x] Event label: `request.created` → "Request submitted"

### Frontend
- [x] API client: `publicRequest()` + request methods
- [x] Public form page (`/request/:tenantSlug`)
- [x] Confirmation page (`/request/:tenantSlug/success`)
- [x] Authenticated list page (`/requests`)
- [x] Routing: add public + authenticated routes
- [x] Sidebar: activate Requests nav item
- [x] Dashboard: "New Requests" count card

### Testing
- [x] Unit tests: use case (9 tests)
- [x] Integration tests: public + authenticated routes (12 tests)
- [x] E2E tests: form submission + owner list + a11y (3 tests)

### Documentation
- [x] Update CLAUDE.md with new patterns
