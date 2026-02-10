# Seedling-HQ

Field service management platform for small businesses. Built as a multi-tenant SaaS with an internal-user + external-secure-link access model.

## Prerequisites

- **Node.js 24** (see `.nvmrc`)
- **pnpm** (`corepack enable && corepack prepare pnpm@9.15.4 --activate`)
- **Docker** (for Postgres and Mailpit)

## Quick Start

```bash
pnpm i              # install all workspace dependencies
make deps           # start Docker services, push DB schema, seed demo data
pnpm dev            # start API (:4000) + Web (:5173)
```

Open:
- **App:** http://localhost:5173/signup
- **API health:** http://localhost:4000/health
- **Swagger UI:** http://localhost:4000/docs
- **Mailpit UI:** http://localhost:8025

## Project Structure

```
Seedling-HQ/
  packages/shared/       # @seedling/shared — shared TypeScript types (AuthContext)
  apps/api/              # @seedling/api — Fastify 5 backend
  apps/web/              # @seedling/web — React 19 + Vite frontend
  e2e/                   # @seedling/e2e — Playwright E2E tests
  docs/context/          # Architecture & design context packs (10 files)
  docs/stories/          # Story implementation checklists
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | pnpm workspaces |
| API | Fastify 5, Zod, Pino |
| Database | PostgreSQL 17, Drizzle ORM |
| Frontend | React 19, Vite 6, Tailwind CSS v4, TanStack Query |
| Testing | Vitest (unit/integration), Playwright (E2E), axe-core (a11y) |
| Auth | AWS Cognito (planned), `AUTH_MODE=local` mock for dev |
| Infra | Docker Compose (local), AWS CDK (planned) |

## Scripts

### Root (run from repo root)

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start API and Web dev servers concurrently |
| `pnpm build` | Build all packages |
| `pnpm test` | Run unit tests across all packages |
| `pnpm test:integration` | Run API integration tests (requires Postgres) |
| `pnpm test:e2e` | Run Playwright E2E tests |
| `pnpm gen` | Generate OpenAPI JSON from API routes |
| `pnpm typecheck` | Type-check all packages |

### Makefile

| Target | Description |
|--------|-------------|
| `make deps` | Full setup: start Docker, push schema, seed data |
| `make deps-up` | Start Docker services and wait for Postgres |
| `make deps-down` | Stop Docker services |
| `make deps-reset` | Stop Docker, remove volumes, and re-setup |

### API (`pnpm --filter @seedling/api run <script>`)

| Script | Description |
|--------|-------------|
| `dev` | Start dev server with hot reload (port 4000) |
| `test` | Run unit tests |
| `test:integration` | Run integration tests against real Postgres |
| `db:push` | Push Drizzle schema to database |
| `db:seed` | Seed demo tenant, user, services, clients, properties, requests, draft quote, sent quote with secure link token, and audit events |
| `gen` | Generate OpenAPI spec to `openapi.json` |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Health check |
| POST | `/v1/tenants` | None | Signup: create tenant + owner user |
| GET | `/v1/tenants/me` | Required | Get current tenant |
| GET | `/v1/users/me` | Required | Get current user |
| GET | `/v1/tenants/me/settings` | Required | Get business settings (or null) |
| PUT | `/v1/tenants/me/settings` | Required | Upsert business settings |
| GET | `/v1/services/categories` | Required | List service categories |
| POST | `/v1/services/categories` | Required | Create service category |
| GET | `/v1/services/categories/:id` | Required | Get service category |
| PUT | `/v1/services/categories/:id` | Required | Update service category |
| DELETE | `/v1/services/categories/:id` | Required | Deactivate service category (soft delete) |
| GET | `/v1/services` | Required | List service items |
| POST | `/v1/services` | Required | Create service item |
| GET | `/v1/services/:id` | Required | Get service item |
| PUT | `/v1/services/:id` | Required | Update service item |
| DELETE | `/v1/services/:id` | Required | Deactivate service item (soft delete) |
| GET | `/v1/clients` | Required | List clients (paginated, searchable) |
| POST | `/v1/clients` | Required | Create client |
| GET | `/v1/clients/count` | Required | Count active clients |
| GET | `/v1/clients/:id` | Required | Get client |
| PUT | `/v1/clients/:id` | Required | Update client |
| DELETE | `/v1/clients/:id` | Required | Deactivate client (soft delete, cascades to properties) |
| GET | `/v1/clients/:clientId/properties` | Required | List client's properties |
| POST | `/v1/clients/:clientId/properties` | Required | Add property to client |
| GET | `/v1/clients/:clientId/timeline` | Required | Client activity timeline (paginated, `?exclude=deactivated`) |
| GET | `/v1/properties/:id` | Required | Get property |
| PUT | `/v1/properties/:id` | Required | Update property |
| DELETE | `/v1/properties/:id` | Required | Deactivate property (soft delete) |
| POST | `/v1/public/requests/:tenantSlug` | None | Submit public service request (rate-limited, honeypot) |
| GET | `/v1/requests` | Required | List requests (paginated, searchable, `?status=`) |
| GET | `/v1/requests/count` | Required | Count requests (`?status=new`) |
| GET | `/v1/requests/:id` | Required | Get request |
| POST | `/v1/requests/:id/convert` | Required | Convert request to client + property + quote draft |
| GET | `/v1/quotes` | Required | List quotes (paginated, searchable, `?status=`) |
| GET | `/v1/quotes/count` | Required | Count quotes (`?status=`) |
| GET | `/v1/quotes/:id` | Required | Get quote |
| PUT | `/v1/quotes/:id` | Required | Update quote (draft only) |
| POST | `/v1/quotes/:id/send` | Required | Send quote to client (draft only, creates secure link, returns token+link) |
| GET | `/v1/ext/quotes/:token` | External token | View sent quote publicly (token-authenticated, no login) |

## Architecture

The API follows **Clean Architecture** with clear layer boundaries:

```
domain/          Entities and value types (no dependencies)
application/     Use cases, ports (repository interfaces), DTOs
adapters/http/   Route handlers, middleware (depends on application)
infra/           Drizzle repositories, auth providers, email sender (implements ports)
```

### Multi-Tenancy

Every data query is scoped by `tenant_id`. The `users` table has a composite unique constraint on `(tenant_id, email)` — the same email can exist in different tenants. Cross-tenant access is denied at the repository level.

### Auth (Local Dev)

`AUTH_MODE=local` reads `DEV_AUTH_TENANT_ID`, `DEV_AUTH_USER_ID`, and `DEV_AUTH_ROLE` from `.env` and injects them into every authenticated request. This mode refuses to activate when `NODE_ENV=production`.

The demo seed creates:
- **Tenant:** `00000000-0000-0000-0000-000000000001` (slug: `demo`)
- **User:** `00000000-0000-0000-0000-000000000010` (email: `owner@demo.local`, role: `owner`)
- **Service categories:** Lawn Care, Tree Service, Landscaping (with 8 service items)
- **Clients:** John Smith, Jane Johnson, Bob Wilson (with 3 properties)
- **Requests:** Sarah Davis, Mike Chen, Emily Rodriguez (3 public_form requests, all `new`)
- **Quotes:** "Lawn Service for John Smith" (draft, 2 line items, $70 total) + "Tree Service for Jane Johnson" (sent, 2 line items, $720 total with secure link token)
- **Audit events:** tenant/user signup + client/property/request/quote creation events (for timeline)

## Database

PostgreSQL 17 via Docker Compose. Schema managed by Drizzle ORM with `db:push` for local dev.

**Tables (S-0001 through S-0010):**
- `tenants` — id, slug (unique), name, status, timestamps
- `users` — id, tenant_id (FK), email, full_name, role, status, timestamps
- `audit_events` — id, tenant_id (FK), event_name, principal/subject info, correlation_id, created_at; indexes on `(tenant_id, created_at)` and `(tenant_id, subject_type, subject_id, created_at)`
- `business_settings` — id, tenant_id (FK, unique), phone, address fields, timezone, business_hours (JSONB), service_area, default_duration_minutes, description, timestamps
- `service_categories` — id, tenant_id (FK), name, description, sort_order, active, timestamps; unique (tenant_id, name)
- `service_items` — id, tenant_id (FK), category_id (FK), name, description, unit_price (cents), unit_type, estimated_duration_minutes, active, sort_order, timestamps; unique (tenant_id, category_id, name)
- `clients` — id, tenant_id (FK), first_name, last_name, email, phone, company, notes, tags (JSONB), active, timestamps; unique (tenant_id, email)
- `properties` — id, tenant_id (FK), client_id (FK), address fields, notes, active, timestamps; unique (tenant_id, client_id, address_line1)
- `requests` — id, tenant_id (FK), source, client_name, client_email, client_phone, description, status, assigned_user_id, timestamps; indexes on `(tenant_id, created_at)` and `(tenant_id, status)`
- `message_outbox` — id, tenant_id (FK), type, recipient_id, recipient_type, channel, subject, body, status, provider, provider_message_id, attempt_count, last_error_code, last_error_message, correlation_id, scheduled_for, created_at, sent_at; indexes on `(tenant_id, created_at)` and `(status, created_at)`
- `quotes` — id, tenant_id (FK), request_id (FK, nullable), client_id (FK), property_id (FK, nullable), title, line_items (JSONB), subtotal, tax, total, status (default 'draft'), sent_at, approved_at, declined_at, timestamps; indexes on `(tenant_id)`, `(client_id)`, `(request_id)`, `(tenant_id, status)`
- `secure_link_tokens` — id, tenant_id (FK), token_hash (varchar 64, unique), hash_version, subject_type, subject_id, scopes (JSONB), expires_at, revoked_at, created_by_user_id, created_at, last_used_at; indexes on `(tenant_id, subject_type, subject_id)`

## Testing

```bash
pnpm test                # 132 unit tests
pnpm test:integration    # 116 integration tests (needs Postgres)
pnpm test:e2e            # 80 E2E tests, 54 run + 26 skipped (starts API + Web automatically)
```

Integration tests truncate tables between runs. E2E tests re-seed the database via `globalSetup` before each run.

**Tip:** After running E2E tests, the database will contain test-created data. To restore clean state for manual testing:

```bash
pnpm --filter @seedling/api run db:reset && pnpm --filter @seedling/api run db:push && pnpm --filter @seedling/api run db:seed
```

Run a single test file:

```bash
pnpm --filter @seedling/api exec vitest run test/unit/timeline.test.ts          # unit
pnpm --filter @seedling/api exec vitest run --config vitest.integration.config.ts test/integration/timeline-routes.test.ts  # integration
pnpm exec playwright test e2e/tests/client-timeline.spec.ts --project=desktop-chrome  # E2E
```

## Environment Variables

See `.env.example` for all variables. Copy to `.env` before starting:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://fsa:fsa@localhost:5432/fsa` | Postgres connection string |
| `API_PORT` | `4000` | API server port |
| `NODE_ENV` | `development` | Environment (`development`, `test`, `production`) |
| `AUTH_MODE` | `local` | Auth strategy (`local` or `cognito`) |
| `DEV_AUTH_TENANT_ID` | _(demo UUID)_ | Tenant ID injected in local auth mode |
| `DEV_AUTH_USER_ID` | _(demo UUID)_ | User ID injected in local auth mode |
| `DEV_AUTH_ROLE` | `owner` | Role injected in local auth mode |
| `NOTIFICATION_ENABLED` | `true` | Enable/disable email notifications on new requests |
| `SMTP_HOST` | `localhost` | SMTP server host (Mailpit locally) |
| `SMTP_PORT` | `1025` | SMTP server port (Mailpit locally) |
| `SMTP_FROM` | `noreply@seedling.local` | Sender email address for notifications |
| `APP_BASE_URL` | `http://localhost:5173` | Base URL for constructing secure quote links |
| `SECURE_LINK_HMAC_SECRET` | `dev-secret-change-in-production` | HMAC secret for signing secure link tokens (change in production) |

## AI Context

This repo uses `CLAUDE.md` as an AI context index. It points to 10 context packs in `docs/context/` covering architecture, UI/UX, testing, security, observability, DevEx conventions, data access patterns, domain model, and API standards. Read `CLAUDE.md` first before making design or implementation decisions.
