# S-0006: Public "Request Service" Form

## Acceptance Criteria
- External customer can submit a service request via public form (no auth required)
- Request record is created, tenant-scoped via slug
- Confirmation page shown after submission
- Honeypot field + per-IP rate limit for spam protection
- Request appears in authenticated owner list

## Checklist

### Backend
- [ ] Domain entity: `Request` interface + types
- [ ] DB schema: `requests` table with indexes
- [ ] Repository port: `RequestRepository`
- [ ] Drizzle repository implementation
- [ ] DTOs: `CreatePublicRequestInput`, `RequestOutput`
- [ ] Use case: `CreatePublicRequestUseCase` (TDD)
- [ ] Rate limit middleware (in-memory sliding window)
- [ ] Routes: public POST + authenticated GET list/count/by-id
- [ ] Register in app.ts
- [ ] Seed data: 3 demo requests + audit events
- [ ] Event label: `request.created` → "Request submitted"

### Frontend
- [ ] API client: `publicRequest()` + request methods
- [ ] Public form page (`/request/:tenantSlug`)
- [ ] Confirmation page (`/request/:tenantSlug/success`)
- [ ] Authenticated list page (`/requests`)
- [ ] Routing: add public + authenticated routes
- [ ] Sidebar: activate Requests nav item
- [ ] Dashboard: "New Requests" count card

### Testing
- [ ] Unit tests: use case + rate limiter
- [ ] Integration tests: public + authenticated routes
- [ ] E2E tests: form submission + owner list

### Documentation
- [ ] Update CLAUDE.md with new patterns
