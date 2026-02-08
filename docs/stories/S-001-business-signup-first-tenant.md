# S-001 — Business Signup + First Tenant

**Status:** Complete
**Last updated:** 2026-02-08

> As an owner, I can sign up, create a tenant, and land on a dashboard.

## Acceptance Criteria
- [x] API enforces `tenant_id` on all created records
- [x] Owner role assigned to first user
- [x] Demo tenant seeded in local mode
- [x] Telemetry: `auth.signup`, `tenant.created`
- [x] Local dev contract works: `pnpm i` → `make deps` → `pnpm gen` → `pnpm dev`

## Design Decisions (S-001 specific)
- **POST /v1/tenants is unauthenticated** — signup endpoint; no existing tenant/user to auth against
- **`db:push` not `db:migrate`** — simpler for greenfield; migrations introduced in S-002+
- **Vite proxy** to API at localhost:4000 — avoids CORS config for local dev
- **No Testcontainers** — reuse docker-compose Postgres; truncate tables between tests
- **Pino** for structured JSON logging
- **Drizzle ORM** with drizzle-kit for schema management
- **`--env-file=../../.env`** on tsx scripts — loads root .env without dotenv dependency (Node 24)
- **Tailwind CSS v4** with `@tailwindcss/vite` plugin — no postcss.config or tailwind.config needed
- **Manual shadcn components** — hand-written instead of CLI-generated (button, input, label, card, sheet)

## Deferred (not in S-001)
- Cognito JWT validation (`AUTH_MODE=cognito`)
- `message_outbox` table (S-021)
- `secure_link_tokens` table (S-010)
- LocalStack / SQS / EventBridge (S-007+)
- CI/CD pipeline
- Full OpenAPI client generation (simple fetch wrapper for now)

---

## Phase 1: Scaffolding

- [x] **1.1** Create root monorepo config
- [x] **1.2** Create workspace directories and package.json files
- [x] **1.3** Create docker-compose.yml + Makefile

---

## Phase 2: API

- [x] **2.1** Create shared package (`packages/shared/`)
- [x] **2.2** Create API shared utilities (`apps/api/src/shared/`)
- [x] **2.3** Create domain layer (`apps/api/src/domain/`)
- [x] **2.4** Create application layer (`apps/api/src/application/`)
- [x] **2.5** Write unit tests for CreateTenantUseCase (TDD)
  - [x] Happy path: valid input creates tenant + user + audit events
  - [x] Slug conflict: throws ConflictError
  - [x] Slugify: produces URL-safe slugs from various business names
  - [x] Audit events: both `tenant.created` and `auth.signup` recorded with correct fields
- [x] **2.6** Create Drizzle schema + config
- [x] **2.7** Create infrastructure repositories
- [x] **2.8** Create auth middleware + HTTP middleware
  - [x] Local mode injects correct authContext from env vars
  - [x] Refuses to activate in production
- [x] **2.9** Create route handlers
- [x] **2.10** Create app factory + entry point
- [x] **2.11** Create seed script
- [x] **2.12** Write integration tests
  - [x] POST /v1/tenants with valid body returns 201 + tenant + user
  - [x] POST /v1/tenants with duplicate slug returns 409
  - [x] POST /v1/tenants with invalid body returns 400
  - [x] GET /v1/tenants/me returns tenant
  - [x] GET /v1/users/me returns user
  - [x] Tenant B context cannot see Tenant A data via GET /v1/tenants/me
  - [x] Tenant B context cannot see Tenant A users via GET /v1/users/me
- [x] **2.13** Create OpenAPI generation script

---

## Phase 3: Web

- [x] **3.1** Scaffold Vite + React app
- [x] **3.2** Set up Tailwind CSS + shadcn/ui
- [x] **3.3** Create API client
- [x] **3.4** Build app shell
- [x] **3.5** Build signup page
- [x] **3.6** Build dashboard page

---

## Phase 4: E2E + Polish

- [x] **4.1** Set up Playwright + write E2E tests
  - [x] Navigate to /signup, fill form, submit, verify redirect to /dashboard
  - [x] Dashboard data visible after signup
  - [x] Mobile viewport (375x812): form usable, no horizontal scroll
  - [x] Accessibility: axe-core scan on signup + dashboard pages (both desktop + mobile)
- [x] **4.2** Verify full local dev contract
- [x] **4.3** Final cleanup

## Test Summary
- **13 unit tests** (create-tenant use case + slugify + auth middleware)
- **7 integration tests** (tenant routes + cross-tenant isolation)
- **8 E2E tests** (signup flow + mobile + a11y, desktop + mobile chrome)
- **Total: 28 tests, all passing**
