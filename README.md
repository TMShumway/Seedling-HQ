# Seedling HQ

Seedling HQ is a field service management platform for small businesses — lawn care, tree service, landscaping, cleaning, and similar trades. It helps owners manage the full lifecycle from incoming service requests through quoting, scheduling, and invoicing.

Built as a multi-tenant SaaS with two access models:
- **Internal users** (business owners and technicians) log in via the web app
- **External customers** receive secure links to view and approve quotes, pay invoices, etc. — no login required

## What's Built So Far

Seedling HQ is under active development. Here's what's working today:

| Feature | Status | Description |
|---------|--------|-------------|
| Signup + onboarding | Done | Create a business account, configure profile, hours, and service defaults |
| Service catalog | Done | Two-level catalog (categories and items) with pricing in dollars |
| Client management | Done | Client records with properties (service addresses), activity timeline |
| Public request form | Done | Embeddable form for customers to request service — with spam protection |
| Request notifications | Done | Email alerts to the business owner when new requests arrive |
| Request conversion | Done | Convert incoming requests into clients, properties, and draft quotes |
| Quote builder | Done | Inline line-item editor with service picker, tax, and auto-totals |
| Create standalone quotes | Done | Create quotes directly for existing clients (no request needed) |
| Send quotes via secure link | Done | One-click send generates a secure link; quote is viewable without login |
| Customer approves/declines | Done | Customers approve or decline quotes from the secure link |
| Scheduling + jobs | Planned | Calendar view, visit tracking, technician "Today" page |
| Invoicing + payments | Planned | Invoice generation, Stripe payments via secure link |

## Prerequisites

- **Node.js 24** (see `.nvmrc`)
- **pnpm** — `corepack enable && corepack prepare pnpm@9.15.4 --activate`
- **Docker** — for Postgres and Mailpit (local email capture)

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url> && cd Seedling-HQ
pnpm i

# 2. Set up environment
cp .env.example .env

# 3. Start services, create DB schema, seed demo data
make deps

# 4. Start the app
pnpm dev
```

Once running, open:

| URL | What |
|-----|------|
| http://localhost:5173/signup | Create a new business account |
| http://localhost:5173/dashboard | Dashboard (uses demo tenant by default) |
| http://localhost:4000/docs | Swagger UI — browse and test API endpoints |
| http://localhost:8025 | Mailpit — see captured emails (request notifications, quote sends) |

## Demo Walkthrough

The seed data creates a ready-to-explore demo tenant. After `make deps` and `pnpm dev`:

1. **Dashboard** (http://localhost:5173/dashboard) — see metric cards for clients, requests, and quotes
2. **Services** — browse Lawn Care, Tree Service, and Landscaping categories with 8 service items
3. **Clients** — 3 seeded clients (John Smith, Jane Johnson, Bob Wilson) each with a property
4. **Requests** — 3 incoming requests from the public form, all with status "New"
5. **Quotes** — 1 draft quote and 2 sent quotes (with secure links you can follow)

To try the full flow yourself:
1. Submit a request at http://localhost:5173/request/demo
2. Check the notification email in Mailpit (http://localhost:8025)
3. Open the request in the app and click "Convert to Client"
4. Edit the draft quote — add line items, set pricing
5. Click "Send Quote" — copy the secure link
6. Open the secure link in an incognito window to see the customer view
7. Approve or decline the quote

## Project Structure

```
Seedling-HQ/
  apps/api/              Fastify 5 backend (Clean Architecture)
  apps/web/              React 19 + Vite frontend
  packages/shared/       Shared TypeScript types (AuthContext)
  e2e/                   Playwright E2E tests
  docs/context/          Architecture & design context packs (10 files)
  docs/stories/          Story implementation checklists
```

### Backend Architecture (Clean Architecture)

```
apps/api/src/
  domain/          Entities and value types (no dependencies)
  application/     Use cases, ports (repository interfaces), DTOs
  adapters/http/   Route handlers, middleware
  infra/           Drizzle repositories, auth providers, email sender
  shared/          Errors, config, logging
```

Dependencies point inward: infra → application → domain. Route handlers validate input and call use cases. Use cases enforce business rules and call repository ports. Infrastructure implements those ports.

### Frontend

```
apps/web/src/
  app-shell/       Sidebar, TopBar, MobileDrawer
  pages/           One file per page/route
  components/ui/   Reusable UI components (Button, Input, Card, etc.)
  lib/             API client, auth helpers, utilities
```

Built with React 19, Vite, Tailwind CSS v4, and TanStack Query. Responsive layout with sidebar navigation on desktop and drawer on mobile.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | pnpm workspaces |
| API | Fastify 5, Zod, Pino |
| Database | PostgreSQL 17, Drizzle ORM |
| Frontend | React 19, Vite 6, Tailwind CSS v4, TanStack Query |
| Testing | Vitest (unit + integration), Playwright (E2E), axe-core (a11y) |
| Auth | AWS Cognito (planned), `AUTH_MODE=local` mock for dev |
| Email | Nodemailer + Mailpit (local), SES (planned) |
| Infra | Docker Compose (local), AWS CDK (planned) |

## Development

### Common Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start API (:4000) + Web (:5173) with hot reload |
| `pnpm build` | Build all packages |
| `pnpm test` | Run unit tests |
| `pnpm test:integration` | Run integration tests (requires Postgres) |
| `pnpm test:e2e` | Run Playwright E2E tests (starts servers automatically) |
| `pnpm gen` | Regenerate OpenAPI spec from routes |
| `pnpm typecheck` | Type-check all packages |

### Makefile Shortcuts

| Target | Description |
|--------|-------------|
| `make deps` | Full setup: Docker up, push schema, seed data |
| `make deps-up` | Start Docker services only |
| `make deps-down` | Stop Docker services |
| `make deps-reset` | Wipe everything and re-setup from scratch |

### Database

PostgreSQL 17 runs via Docker Compose. Schema is managed by Drizzle ORM.

| Command | Description |
|---------|-------------|
| `pnpm --filter @seedling/api run db:push` | Apply schema to database |
| `pnpm --filter @seedling/api run db:seed` | Seed demo data |
| `pnpm --filter @seedling/api run db:reset` | Truncate all tables |

To restore a clean database (e.g. after E2E tests leave test data behind):

```bash
pnpm --filter @seedling/api run db:reset && pnpm --filter @seedling/api run db:push && pnpm --filter @seedling/api run db:seed
```

**Tables:** tenants, users, audit_events, business_settings, service_categories, service_items, clients, properties, requests, message_outbox, quotes, secure_link_tokens

### Running a Single Test

```bash
# Unit
pnpm --filter @seedling/api exec vitest run test/unit/create-quote.test.ts

# Integration
pnpm --filter @seedling/api exec vitest run --config vitest.integration.config.ts test/integration/quote-routes.test.ts

# E2E (single spec, single browser)
pnpm exec playwright test e2e/tests/quotes.spec.ts --project=desktop-chrome
```

### Test Coverage

```
Unit:        163 tests
Integration: 137 tests (requires Postgres)
E2E:          94 tests (62 run + 32 skipped on non-desktop projects)
```

## Multi-Tenancy

Every database query is scoped by `tenant_id`. The same email address can exist in different tenants. Cross-tenant access is denied at the repository level — there's no way to accidentally query another tenant's data.

### Auth (Local Dev)

In development, `AUTH_MODE=local` injects auth context from environment variables. No real JWT validation happens. The `.env` file points to the demo tenant by default.

The frontend stores tenant/user IDs in `localStorage` after signup, sending them as headers on every request. To switch back to the demo tenant after signing up a new one:

```js
// Run in browser console
localStorage.removeItem('dev_tenant_id');
localStorage.removeItem('dev_user_id');
location.reload();
```

### Secure Links (External Access)

Customers access quotes (and eventually invoices) via secure links like `http://localhost:5173/quote/<token>`. These tokens are:
- Hashed with HMAC-SHA256 before storage (raw token is never persisted)
- Scoped to a specific object and action (e.g., "read and respond to this quote")
- Time-limited (14 days default, configurable 1-90)
- Revocable

## API Endpoints

### System

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Health check |

### Tenants + Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/v1/tenants` | None | Signup: create tenant + owner user |
| GET | `/v1/tenants/me` | Required | Get current tenant |
| GET | `/v1/users/me` | Required | Get current user |
| GET | `/v1/tenants/me/settings` | Required | Get business settings (null if not configured) |
| PUT | `/v1/tenants/me/settings` | Required | Create or update business settings |

### Services

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/v1/services/categories` | Required | List categories |
| POST | `/v1/services/categories` | Required | Create category |
| GET | `/v1/services/categories/:id` | Required | Get category |
| PUT | `/v1/services/categories/:id` | Required | Update category |
| DELETE | `/v1/services/categories/:id` | Required | Deactivate category + its items |
| GET | `/v1/services` | Required | List service items (`?categoryId=`) |
| POST | `/v1/services` | Required | Create service item |
| GET | `/v1/services/:id` | Required | Get service item |
| PUT | `/v1/services/:id` | Required | Update service item |
| DELETE | `/v1/services/:id` | Required | Deactivate service item |

### Clients + Properties

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/v1/clients` | Required | List clients (`?search=`, `?limit=`, `?cursor=`) |
| POST | `/v1/clients` | Required | Create client |
| GET | `/v1/clients/count` | Required | Count active clients |
| GET | `/v1/clients/:id` | Required | Get client |
| PUT | `/v1/clients/:id` | Required | Update client |
| DELETE | `/v1/clients/:id` | Required | Deactivate client (cascades to properties) |
| GET | `/v1/clients/:clientId/properties` | Required | List properties for a client |
| POST | `/v1/clients/:clientId/properties` | Required | Add property to client |
| GET | `/v1/clients/:clientId/timeline` | Required | Activity timeline (`?exclude=deactivated`) |
| GET | `/v1/properties/:id` | Required | Get property |
| PUT | `/v1/properties/:id` | Required | Update property |
| DELETE | `/v1/properties/:id` | Required | Deactivate property |

### Requests

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/v1/public/requests/:tenantSlug` | None | Submit public service request (rate-limited) |
| GET | `/v1/requests` | Required | List requests (`?search=`, `?status=`, `?cursor=`) |
| GET | `/v1/requests/count` | Required | Count requests (`?status=new`) |
| GET | `/v1/requests/:id` | Required | Get request |
| POST | `/v1/requests/:id/convert` | Required | Convert to client + property + draft quote |

### Quotes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/v1/quotes` | Required | Create standalone draft quote |
| GET | `/v1/quotes` | Required | List quotes (`?search=`, `?status=`, `?cursor=`) |
| GET | `/v1/quotes/count` | Required | Count quotes (`?status=`) |
| GET | `/v1/quotes/:id` | Required | Get quote with line items |
| PUT | `/v1/quotes/:id` | Required | Update quote (draft only) |
| POST | `/v1/quotes/:id/send` | Required | Send quote link to customer |
| GET | `/v1/ext/quotes/:token` | Secure link | View quote (customer-facing) |
| POST | `/v1/ext/quotes/:token/approve` | Secure link | Approve quote (idempotent) |
| POST | `/v1/ext/quotes/:token/decline` | Secure link | Decline quote (idempotent) |

## Environment Variables

Copy `.env.example` to `.env` before starting. Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://fsa:fsa@localhost:5432/fsa` | Postgres connection string |
| `API_PORT` | `4000` | API server port |
| `AUTH_MODE` | `local` | Auth strategy (`local` or `cognito`) |
| `NOTIFICATION_ENABLED` | `true` | Email notifications on new requests |
| `SMTP_HOST` / `SMTP_PORT` | `localhost` / `1025` | Mailpit SMTP (local email capture) |
| `APP_BASE_URL` | `http://localhost:5173` | Base URL for secure quote links |
| `SECURE_LINK_HMAC_SECRET` | `dev-secret-...` | HMAC secret for token hashing (change in production) |

## AI Context

This repo uses `CLAUDE.md` as an AI context index. It points to 10 context packs in `docs/context/` covering architecture, UI/UX, testing, security, observability, conventions, data access, domain model, and API standards. AI agents should read `CLAUDE.md` first before making design or implementation decisions.
