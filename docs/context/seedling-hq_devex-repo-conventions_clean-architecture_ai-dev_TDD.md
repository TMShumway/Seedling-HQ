# Seedling-HQ — DevEx + Repo Conventions (Clean Architecture Rails) for AI-Driven Development

_Last updated: 2026-02-08 (America/Chihuahua)_

> Purpose: Give humans + AI agents a **single, consistent way** to add features without drifting architecture.
> This document establishes **Clean Architecture-inspired boundaries** for Seedling-HQ while staying pragmatic for MVP.

---

## 1) Core principles (non-negotiable)

1) **AWS-first + local-first**
   - Every story must run locally with the standard commands and local endpoints.
2) **Spec-driven**
   - API schemas → OpenAPI → generated TS client/types.
3) **Multi-tenant safety**
   - Tenant = internal customer (business). External customers are tenant-owned records.
4) **External access via secure links**
   - Token-based, tenant-bound, object-bound, scope-bound.
5) **Consistency over cleverness**
   - Prefer standard patterns; avoid introducing new frameworks or patterns without a clear need.

---

## 2) Clean Architecture (how we apply it)

Clean Architecture in this repo means:

### 2.1 Layers and dependency direction
- **Domain** (pure): entities, value objects, domain rules, status transitions
- **Application** (use cases): orchestrates domain logic, authorization decisions, calls ports
- **Interface adapters** (controllers/presenters): Fastify route handlers, DTO mapping, HTTP concerns
- **Infrastructure**: DB, SQS, SES/SMS, S3, Scheduler, AWS SDK clients, Stripe, etc.

**Dependency direction:**
- Infrastructure depends on Application/Domain.
- Interface adapters depend on Application/Domain.
- Application depends on Domain and **ports (interfaces)**.
- Domain depends on nothing.

### 2.2 What goes where (cheat sheet)

**Domain**
- Status/state machines (Quote/Invoice/Job/Visit)
- Invariants (e.g., “cannot approve already approved quote”)
- Pure calculators (totals, tax, durations)

**Application (Use Cases + Ports)**
- "Upsert business settings" (singleton per tenant; no UoW needed)
- "Send quote link"
- "Approve quote"
- "Create job from approved quote"
- "Schedule visit + create reminders"
- "Complete visit + photos"
- "Generate invoice + send"
- "Pay invoice (webhook)"
- "Enqueue SMS job and update outbox"
- `UnitOfWork` port — wraps atomic multi-repo writes in a transaction

**Interface adapters**
- Fastify route handler wiring
- Input validation + mapping to use case request DTO
- Auth middleware: Cognito JWT validation (internal routes) or secure-link token resolution (external routes) → produces `authContext`
- Output formatting (HTTP status codes, response DTO)

**Infrastructure**
- Cognito JWKS client (JWT signature verification, key caching)
- Auth mode switch (`AUTH_MODE=cognito` vs `AUTH_MODE=local`)
- Postgres repositories
- `DrizzleUnitOfWork` — implements `UnitOfWork` via `db.transaction()`
- SQS publisher/consumer wiring
- EventBridge Scheduler client
- S3 presigned URL generation
- SMS v2 / SES providers
- Stripe webhook verifier

---

## 2.3 TDD workflow (default expectation)

We use **TDD as the default workflow** for domain + application work (and often for route handlers):

**Loop:**
1) **Red** — write a failing test that captures the requirement (including pitfalls like tenancy, secure-link scope, idempotency).
2) **Green** — implement the minimum code to make the test pass.
3) **Refactor** — improve structure while keeping tests green (extract ports, remove duplication, tighten types).

**Where TDD is required vs recommended**
- **Required (TDD-first):**
  - Domain rules/state machines (status transitions)
  - Authorization policies (RBAC + secure-link scopes/object binding)
  - Use cases (application layer orchestration)
  - Worker handlers (idempotency and retry behavior)
- **Recommended (TDD where practical):**
  - Route handlers (Fastify inject tests are usually fast)
  - UI components with non-trivial logic (Testing Library)
- **Not required (test afterwards is acceptable):**
  - Pure wiring/config where tests add little value (but still add integration tests when risk is high)

**TDD must incorporate security + tenancy**
When writing the first failing test, include at least one:
- cross-tenant denial case (where applicable)
- scope mismatch / token invalid case (for external flows)
- idempotency retry case (for worker/outbox jobs)

---

## 3) Folder structure (recommended)

This is a recommended baseline that fits the current `apps/api` scaffold (Fastify + TS):

```
apps/api/src/
  domain/
    entities/
    services/        # pure domain services (no IO)
    policies/        # pure authorization helpers (no IO)
    types/           # enums, shared types
  application/
    usecases/
    ports/           # interfaces for repositories/providers
    dto/             # use case input/output types
  adapters/
    http/
      routes/
      middleware/
      presenters/
  infra/
    auth/            # Cognito JWKS client, AUTH_MODE switch
    db/
      repositories/
      migrations/
    queue/
    comms/
    storage/
    payments/
  shared/
    logging/
    errors/
    config/
```

Web app can mirror the idea more lightly:

```
apps/web/src/
  app-shell/
  pages/
  components/
  lib/              # api client wrapper, auth helpers, telemetry, utilities
```

---

## 4) Naming conventions (code)

- Use “Tenant” or “Business” for internal customer.
- Use “Client” for external customer.
- Use “SecureLinkToken” (or “AccessToken”) for loginless links.
- Use “Outbox” for durable comms.

Prefer:
- `tenantId` (camelCase in TS)
- DB column: `tenant_id` (snake_case)

---

## 5) Routing conventions (API)

### 5.1 Route grouping
- Internal app routes: `/v1/...`
- External secure link routes: `/public/...` (or `/ext/...`) – keep clearly separated

### 5.2 Auth middleware

**Internal routes (`/v1/...`) — Cognito JWT auth:**
- Middleware reads `Authorization: Bearer <token>` header.
- `AUTH_MODE=cognito`: validates JWT signature (JWKS), issuer, audience, expiry, `token_use`. Extracts claims.
- `AUTH_MODE=local`: skips JWT validation; builds authContext from env vars (`DEV_AUTH_TENANT_ID`, `DEV_AUTH_USER_ID`, `DEV_AUTH_ROLE`).
- Produces `authContext`:
  ```ts
  {
    principal_type: 'internal_user',
    tenant_id: string,   // from custom:tenant_id claim (or DEV_AUTH_TENANT_ID)
    user_id: string,     // from sub claim (or DEV_AUTH_USER_ID)
    role: string,        // from cognito:groups claim (or DEV_AUTH_ROLE)
  }
  ```
- Reject request with 401 if token is missing, invalid, or expired.

**External routes (`/public/...`) — secure-link token auth:**
- Middleware resolves token from URL parameter, hashes it, looks up `secure_link_tokens` table.
- Produces `authContext`:
  ```ts
  {
    principal_type: 'external_token',
    tenant_id: string,
    token_id: string,
    subject_type: string,
    subject_id: string,
    scopes: string[],
  }
  ```
- Reject request with generic error if token is invalid, expired, or revoked.

**Critical rule:** Use cases and domain logic receive `authContext` and never know which mechanism produced it. The auth mechanism is an infrastructure concern.

Do not allow routes to "optionally" be either principal type unless absolutely necessary.

---

## 6) “How to add a feature” checklist (agent rails)

When implementing a story, do this sequence:

1) **Define/Update the API contract**
   - Add/modify Fastify route schemas.
   - Run `pnpm gen` and ensure contract client compiles.

2) **Add/Update domain rules**
   - Update domain types/status transitions if needed.

3) **Implement the use case**
   - Create a use case in `application/usecases/`.
   - Use ports for IO.
   - Enforce authorization rules in application layer.

4) **Implement infra adapters**
   - Add repository/provider implementation in `infra/`.
   - Wire it in composition root (app bootstrap).

5) **Add route handler**
   - Route handler validates input, builds authContext, calls use case, maps output.

6) **Add tests**
   - Unit tests for domain rules/use case logic.
   - Integration tests for route + DB + tenancy boundaries.
   - E2E tests for critical user flows (Playwright), plus a11y checks where required.

7) **Observability**
   - Structured logs with correlation_id + tenant_id
   - Metrics for endpoint/job types
   - Audit events for security-relevant actions

8) **Local demo path**
   - Ensure `pnpm dev` demo steps work end-to-end locally.

---

## 7) Error handling conventions (API)

Use a consistent error strategy:
- Domain throws typed domain errors (no HTTP concerns)
- Application catches and maps to application errors (still no HTTP concerns)
- HTTP adapter maps to:
  - 400 validation
  - 401/403 auth
  - 404 not found (prefer to avoid leaking existence cross-tenant)
  - 409 conflict (invalid transitions)
  - 500 unexpected

Return a consistent JSON error shape (define in your API standards doc when created).

---

## 8) Commit hygiene & formatting

- Prefer small PRs aligned to vertical slices.
- Keep generated files (`packages/api-contract`, `packages/api-client`) updated in the same PR.
- Avoid committing `.env*`.
- Run:
  - typecheck
  - lint
  - unit tests
  - integration tests
  - Playwright smoke tests (for UI-visible changes)

---

## 9) Anti-patterns (what to avoid)

- Business rules in route handlers
- DB calls directly inside UI components without a client wrapper
- Passing `tenant_id` from the client for secure-link requests (derive from token)
- Logging tokens, PII, Stripe secrets
- Worker jobs without idempotency checks
- Introducing global state patterns without a clear need
- **Wrapping multi-step wizard steps in `<form>` tags** — native inputs (time, number) can trigger implicit form submission during re-renders. Use `<div>` + explicit `onClick` handlers (learned in S-002).

---

## 10) Definition of Done (engineering)

A story is “done” only when:
- OpenAPI schemas updated and client regenerated
- Local demo works end-to-end (including async paths)
- Tenant boundaries enforced + cross-tenant tests exist
- External secure-link flows have token binding + scope checks + tests
- Observability added (logs/metrics/audit where relevant)
- Responsive + accessibility audits completed for affected pages (per UI doc cadence)
