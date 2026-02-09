# Seedling-HQ — Comprehensive Testing Context Pack (Vitest + Playwright) for AI-Driven Development

_Last updated: 2026-02-08 (America/Chihuahua)_

> Purpose: Paste this into a new LLM/agent so it can implement **consistent, comprehensive testing** for Seedling-HQ.
> This pattern specifically targets known risk areas: **multi-tenancy**, **secure-link external access**, **async workers**, **scheduler/reminders**, and **mobile-first UX**.

---

## 1) Testing goals (MVP)

MVP testing must guarantee:
- **No cross-tenant data leakage** (API, DB, S3 keying, secure links).
- **External customer flows are safe** (token-bound access + scope checks + audit).
- **Async paths are correct and idempotent** (outbox + SQS + worker; reminders schedule/cancel).
- **Critical workflows work on mobile** (responsive layouts; no horizontal scroll; thumb-friendly actions).
- **Accessibility doesn’t regress** (keyboard navigation, focus, labels, contrast).

---

## 2) Tooling (required)

### 2.1 Unit + integration
- **Vitest** for unit tests (TypeScript).
- **Fastify inject** (recommended) for API handler tests without binding a port.
- **Database integration tests** against a real Postgres container (preferred):
  - Use existing `docker-compose.yml` OR
  - Add **Testcontainers** (Node) if you want fully self-contained test runs.

### 2.2 E2E + Accessibility
- **Playwright** for end-to-end tests (internal app + external secure-link pages).
- For accessibility checks in Playwright:
  - Add **@axe-core/playwright** (recommended) to run automated a11y scans.

### 2.3 Gaps / recommended additions
These fill common holes not covered by Vitest + Playwright alone:

1) **@testing-library/react** (recommended)
   - Component-level testing for UI logic without E2E overhead.
   - Great for form validation, conditional rendering, and “reactive” UI states.

2) **MSW (Mock Service Worker)** (optional but useful)
   - Frontend tests with realistic network mocking.
   - Helps simulate error states and latency without wiring a real API.

3) **OpenAPI contract checks** (recommended)
   - Ensure API responses conform to the generated OpenAPI schema.
   - Practical approach: snapshot/validate `openapi.json` and run a response schema validator in integration tests.

4) **Coverage reporting** (recommended)
   - Vitest coverage (c8/istanbul) with minimal thresholds for critical modules.

---

## 2.4 TDD (how we implement tests day-to-day)

**Default expectation:** Use **TDD** for domain + application code, and prefer it for route handlers and worker logic.

**Red → Green → Refactor**
1) Write a failing test that captures the requirement and the relevant pitfall (tenancy, secure links, async idempotency).
2) Implement the smallest change to pass.
3) Refactor (extract ports/adapters, tighten types, remove duplication) while tests stay green.

**TDD scope guidance**
- **Required TDD-first:**
  - Domain rules/state machines (status transitions)
  - Authorization policies (RBAC + secure-link scope/object binding)
  - Use cases (application orchestration)
  - Worker job handlers (idempotency + retries)
- **Recommended:**
  - API route handlers via Fastify inject (often fast enough to be TDD)
  - UI components with non-trivial behavior via Testing Library
- **Acceptable to test after:**
  - simple wiring/config (but still add integration/e2e coverage when risk is high)

**TDD “first test” must include risk cases**
When writing the initial failing test for a story, include at least one:
- cross-tenant denial test (tenant-owned entities)
- invalid/expired/revoked token test (secure links)
- scope mismatch test (external actions)
- duplicate delivery test (worker/outbox idempotency)

---

## 3) Test pyramid (what to test where)

### 3.1 Unit tests (Vitest) — fast, frequent
Target:
- Pure functions (formatters, calculators, status transitions)
- Authorization policies (RBAC and token scopes) as pure logic
- Validation logic and edge cases
- Worker job handlers as isolated units with mocked providers

### 3.2 Integration tests (Vitest) — realistic system correctness
Target:
- API routes via Fastify inject + real Postgres
- Migrations apply cleanly
- Tenant-scoped queries and indexes behave
- Outbox creation + SQS enqueue payload correctness (SQS mocked, DB real)

### 3.3 E2E tests (Playwright) — “the spine works”
Target:
- Full MVP workflow across UI → API → DB
- External secure-link pages (quote approve / invoice pay / client hub)
- Mobile viewports and essential field flows (Tech Today)
- Accessibility smoke checks on top flows

---

## 4) Non-negotiable invariants (must be tested)

### 4.1 Tenancy invariants
- Every create/read/update/delete is scoped to `tenant_id`.
- No endpoint returns data across tenants.
- All uniqueness constraints are **per-tenant** where applicable.
- S3 keys are tenant-prefixed (and never accept tenant prefix from untrusted input).

**Required tests:**
- "Cross-tenant denial" tests for each core resource type:
  - business_settings (S-002: GET isolation + PUT isolation — implemented)
  - clients, properties, requests, quotes, jobs, visits, invoices, messages/outbox

### 4.2 Secure link invariants (external customers)
- Token resolves to: `(tenant_id, subject_type, subject_id, scopes, expires_at, revoked_at)`
- External endpoints derive tenant solely from token (never from params).
- Object binding is enforced (subject_id match or strict relationship).
- Scope checks gate actions (`quote:approve`, `invoice:pay`, etc.).
- Audit events are recorded for view/send/approve/pay.

**Required tests:**
- Token from Tenant A cannot access Tenant B objects.
- Revoked/expired tokens fail.
- Scope mismatch fails (read token cannot approve/pay).

### 4.3 Async/outbox invariants
- Outbox row is durable source of truth for sends.
- Worker is idempotent (retries do not double-send).
- DLQ behavior is observable (failures mark status and stop thrashing).
- Reminder schedule/cancel is correct.

**Required tests:**
- Same message job delivered twice results in one “send” side effect.
- Cancel pending reminder on payment/approve/decline.

---

## 5) Test design patterns by subsystem

## 5.1 API (Fastify) test pattern
**Preferred approach:**
- Build the Fastify app in-memory
- Use `app.inject()` to call routes
- Use a real Postgres DB (container) for data correctness

**Must cover:**
- Request validation (bad payloads return 400)
- Auth context creation (internal vs external principal):
  - Cognito JWT middleware correctly extracts `tenant_id`, `user_id`, `role` from valid tokens
  - Missing/invalid/expired JWTs return 401
  - In local mode (`AUTH_MODE=local`), mock middleware uses env var defaults
- Tenant filtering on lists/search
- Status transitions and idempotency rules

**Cross-tenant tests (template):**
1) Create Tenant A + Tenant B
2) Create resource in Tenant A
3) Attempt to fetch/update/delete from Tenant B credentials
4) Expect 404/403 (choose one consistently)
5) Ensure DB unchanged

## 5.2 Database test pattern (tenancy + migrations)
**Core assertions:**
- Migrations apply cleanly on empty DB and on DB with prior schema
- Tenant indexes exist for list endpoints (`(tenant_id, created_at)` / `(tenant_id, status)` etc.)
- Uniqueness is tenant-scoped where required

**Recommended tests:**
- Run migrations in CI against a fresh DB
- Seed minimal fixtures and verify query plans if performance becomes an issue (optional for MVP)

## 5.3 Worker / Outbox test pattern
Test worker handlers as:
- **Unit tests** (mock SMS/email providers, assert status updates)
- **Integration tests** (real DB; simulate job payload; verify outbox row transitions)

**Idempotency rules (recommended):**
- Use `message_id` as the dedupe key
- Store `sent_at` / `provider_message_id` and short-circuit if already sent
- Ensure retries update attempt counts but don’t duplicate sends

## 5.4 Scheduler/reminders test pattern
EventBridge Scheduler is hard to run locally. For MVP tests:
- Test “schedule creation” as a unit (payload contains correct queue ARN + role ARN + send time)
- Test “reminder execution” by simulating delivery of the scheduled SQS message to the worker

**Cancelation tests:**
- When quote approved/declined, scheduled follow-ups must be canceled
- When invoice paid, scheduled reminders must be canceled

Implement cancelation keys deterministically (e.g., `reminder:<tenant_id>:<type>:<entity_id>:<sequence>`).

## 5.5 External secure-link pages test pattern (Playwright)
External pages are:
- loginless
- scope-limited
- minimal UI
- high stakes for security + UX

**E2E must cover:**
- Quote view + approve flow (name capture + success state)
- Invoice view + pay CTA (can stub Stripe in test)
- Client hub shows upcoming visits + open invoices
- Token invalid/expired shows a safe error page with support contact

**Security checks in E2E:**
- Swap token across tenants and ensure denial
- Attempt to change URL path IDs and ensure object binding prevents access

---

## 6) UI testing patterns (responsive + accessibility)

### 6.1 Responsive audits (Playwright)
Minimum set of viewports:
- Mobile: 375x812
- Tablet: 768x1024
- Desktop: 1280x800

**Required assertions:**
- No horizontal scrolling on mobile for primary pages
- Primary actions remain reachable (no “hidden CTA”)
- Tables degrade into cards/details on mobile

### 6.2 Accessibility audits (Playwright + axe)
Run automated checks on:
- Login + dashboard shell
- Quote external page
- Invoice external page
- Tech Today page
- Forms: client create, quote builder, invoice send

**Must include manual checks regularly (not one-time):**
- Keyboard-only navigation pass
- Focus order + focus visibility
- Form errors: labeled fields, error summary links to fields

**Minimum cadence:**
- End of every epic
- Before each MVP release candidate

---

## 7) Test data strategy (fixtures)

### 7.1 Tenants & principals fixtures
Always create at least:
- Tenant A + Owner user
- Tenant B + Owner user
- External token for Tenant A (quote/invoice/hub)

For integration/E2E tests:
- Internal auth: use `AUTH_MODE=local` with test-specific `DEV_AUTH_TENANT_ID` and `DEV_AUTH_USER_ID`, or build a mock `authContext` directly in Fastify inject tests.
- For Cognito integration tests (optional, staging): use Cognito test users provisioned in the dev-sandbox User Pool.

### 7.2 IDs & public identifiers
- Prefer UUIDs internally; never depend on guessable integers in tests
- For public forms, test business public identifier cannot be guessed easily

### 7.3 Clock control
Many automation flows depend on time.
Recommended:
- Central “clock” abstraction for app logic (injectable time source)
- In tests, freeze time for deterministic reminders/audit timestamps

---

## 8) CI gates (recommended)

Minimum CI steps:
1) **Typecheck** (tsc)
2) **Lint** (eslint)
3) **Unit + integration** (Vitest) with coverage (optional thresholds)
4) **E2E** (Playwright) headless
5) **OpenAPI contract check**
   - Ensure generated contract is up-to-date (no drift)
6) **DB migration check**
   - Apply migrations cleanly to fresh DB

Optional but useful:
- Upload Playwright trace/video artifacts on failure
- Run a11y scans in CI on key pages

---

## 9) Per-story “test DoD” checklist (agents must follow)

For every story, add tests that cover:

### API / domain
- [ ] Happy path
- [ ] Validation errors
- [ ] Auth errors (internal RBAC or external token scope)
- [ ] **Cross-tenant denial** (if tenant-scoped entity)

### Async (if applicable)
- [ ] Outbox row created/updated correctly
- [ ] Worker processes job and updates status
- [ ] Idempotency test (repeat job doesn’t duplicate side effects)

### UI
- [ ] Loading, empty, error states exist
- [ ] Responsive checks for key screens
- [ ] A11y smoke check (Playwright + axe) for high-impact pages

---

## 10) Known high-risk areas (prioritize tests here)

1) **Secure links** (quote/invoice/hub):
   - tenant-bound + object-bound tokens
   - scope checks
   - revocation/expiry

2) **Lists/search endpoints**:
   - easiest place to forget tenant filter

3) **Scheduler/reminders**:
   - schedule created, delivered, canceled correctly
   - no duplicate sends

4) **Worker retries**:
   - idempotency under retries
   - DLQ behavior

5) **Mobile “field” flows**:
   - Tech Today must work flawlessly on mobile web

---

## Appendix A — Suggested repo structure for tests

Example (adapt to your monorepo layout):
```
apps/api/
  src/
  test/
    unit/
    integration/
apps/web/
  src/
  test/
    unit/
e2e/
  playwright/
    tests/
    fixtures/
```

---

## Appendix B — Stripe testing note (MVP)
In E2E, you can:
- Mock payment completion via a test-only API route, OR
- Use Stripe test mode with controlled events, OR
- Use a “mocked webhook route” for local demo

Regardless, ensure webhook processing is:
- tenant-safe
- idempotent
