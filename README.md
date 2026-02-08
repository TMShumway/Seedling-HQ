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
  docs/context/          # Architecture & design context packs (8 files)
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
| `db:seed` | Seed demo tenant and owner user |
| `gen` | Generate OpenAPI spec to `openapi.json` |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Health check |
| POST | `/v1/tenants` | None | Signup: create tenant + owner user |
| GET | `/v1/tenants/me` | Required | Get current tenant |
| GET | `/v1/users/me` | Required | Get current user |

## Architecture

The API follows **Clean Architecture** with clear layer boundaries:

```
domain/          Entities and value types (no dependencies)
application/     Use cases, ports (repository interfaces), DTOs
adapters/http/   Route handlers, middleware (depends on application)
infra/           Drizzle repositories, auth providers (implements ports)
```

### Multi-Tenancy

Every data query is scoped by `tenant_id`. The `users` table has a composite unique constraint on `(tenant_id, email)` — the same email can exist in different tenants. Cross-tenant access is denied at the repository level.

### Auth (Local Dev)

`AUTH_MODE=local` reads `DEV_AUTH_TENANT_ID`, `DEV_AUTH_USER_ID`, and `DEV_AUTH_ROLE` from `.env` and injects them into every authenticated request. This mode refuses to activate when `NODE_ENV=production`.

The demo seed creates:
- **Tenant:** `00000000-0000-0000-0000-000000000001` (slug: `demo`)
- **User:** `00000000-0000-0000-0000-000000000010` (email: `owner@demo.local`, role: `owner`)

## Database

PostgreSQL 17 via Docker Compose. Schema managed by Drizzle ORM with `db:push` for local dev.

**Tables (S-001):**
- `tenants` — id, slug (unique), name, status, timestamps
- `users` — id, tenant_id (FK), email, full_name, role, status, timestamps
- `audit_events` — id, tenant_id (FK), event_name, principal/subject info, correlation_id, created_at

## Testing

```bash
pnpm test                # 13 unit tests
pnpm test:integration    # 7 integration tests (needs Postgres)
pnpm test:e2e            # 8 E2E tests (starts API + Web automatically)
```

Integration tests truncate tables between runs. E2E tests re-seed the database via `globalSetup` before each run.

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

## AI Context

This repo uses `CLAUDE.md` as an AI context index. It points to 8 context packs in `docs/context/` covering architecture, UI/UX, testing, security, observability, DevEx conventions, and data access patterns. Read `CLAUDE.md` first before making design or implementation decisions.
