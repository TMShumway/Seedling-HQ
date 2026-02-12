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
| Login + logout | Done | Local dev login page with email lookup, account picker, AuthGuard, logout |
| Service catalog | Done | Two-level catalog (categories and items) with pricing in dollars |
| Client management | Done | Client records with properties (service addresses), activity timeline |
| Public request form | Done | Embeddable form for customers to request service — with spam protection |
| Request notifications | Done | Email alerts to the business owner when new requests arrive |
| Request conversion | Done | Convert incoming requests into clients, properties, and draft quotes |
| Quote builder | Done | Inline line-item editor with service picker, tax, and auto-totals |
| Create standalone quotes | Done | Create quotes directly for existing clients (no request needed) |
| Send quotes via secure link | Done | One-click send generates a secure link; quote is viewable without login |
| Customer approves/declines | Done | Customers approve or decline quotes from the secure link |
| Team management | Done | Invite members, assign roles (owner/admin/member), reset passwords, change own password |
| Jobs + visits | Done | Approved quotes create jobs with visits; job list with status filters |
| Schedule calendar | Done | Week/day calendar view, schedule/reschedule visits via modal |
| Technician assignment | Planned | Assign technicians to visits, tech "Today" page |
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
| http://localhost:5173/login | Login page (hint: `owner@demo.local` / `password`) |
| http://localhost:5173/signup | Create a new business account |
| http://localhost:5173/dashboard | Dashboard (requires login) |
| http://localhost:4000/docs | Swagger UI — browse and test API endpoints |
| http://localhost:8025 | Mailpit — see captured emails (request notifications, quote sends) |

## Demo Walkthrough

The seed data creates a ready-to-explore demo tenant. After `make deps` and `pnpm dev`:

1. **Dashboard** (http://localhost:5173/dashboard) — see metric cards for clients, requests, and quotes
2. **Services** — browse Lawn Care, Tree Service, and Landscaping categories with 8 service items
3. **Clients** — 3 seeded clients (John Smith, Jane Johnson, Bob Wilson) each with a property
4. **Requests** — 3 incoming requests from the public form, all with status "New"
5. **Quotes** — 1 draft quote, 2 sent quotes, and 1 scheduled quote (with secure links you can follow)
6. **Schedule** — week calendar showing scheduled visits; unscheduled visits panel for drag-free scheduling
7. **Jobs** — 2 seeded jobs created from approved quotes, each with a visit
8. **Team** — 3 seeded members (Demo Owner, Demo Admin, Demo Member) with role badges; try inviting a new member or resetting a password

To try the full flow yourself:
1. Submit a request at http://localhost:5173/request/demo
2. Check the notification email in Mailpit (http://localhost:8025)
3. Open the request in the app and click "Convert to Client"
4. Edit the draft quote — add line items, set pricing
5. Click "Send Quote" — copy the secure link
6. Open the secure link in an incognito window to see the customer view
7. Approve the quote — this creates a job with a visit
8. Go to **Jobs** to see the new job and its visits
9. Go to **Schedule** and click an unscheduled visit to set a date/time
10. The scheduled visit appears on the calendar — click it to reschedule

## Project Structure

```
Seedling-HQ/
  apps/api/              Fastify 5 backend (Clean Architecture)
  apps/web/              React 19 + Vite frontend
  packages/shared/       Shared TypeScript types (AuthContext)
  e2e/                   Playwright E2E tests
  infra/cdk/             AWS CDK stacks (Cognito User Pool, dev sandbox)
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
| Auth | AWS Cognito (User Pool + JWT validation), `AUTH_MODE=local` mock for dev |
| Email | Nodemailer + Mailpit (local), SES (planned) |
| Infra | Docker Compose (local), AWS CDK (Cognito deployed) |

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

**Tables:** tenants, users, audit_events, business_settings, service_categories, service_items, clients, properties, requests, message_outbox, quotes, secure_link_tokens, jobs, visits

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
Unit:        293 tests (240 API + 53 web)
Integration: 214 tests (requires Postgres)
E2E:         154 tests (77 desktop-chrome + 77 mobile-chrome, 51 skipped non-desktop)
```

## Multi-Tenancy

Every database query is scoped by `tenant_id`. The same email address can exist in different tenants. Cross-tenant access is denied at the repository level — there's no way to accidentally query another tenant's data.

### Auth (Local Dev)

In development, `AUTH_MODE=local` provides a login page at `/login`. Enter an email address and password (hint: `owner@demo.local` / `password` for the demo tenant) to log in. If the email is associated with multiple tenants, you'll see an account picker.

An `AuthGuard` wraps all authenticated routes — unauthenticated visits redirect to `/login`. Logout buttons in the sidebar and mobile drawer clear the session and redirect back to `/login`.

Under the hood, the frontend stores tenant/user IDs in `localStorage` and sends them as `X-Dev-Tenant-Id` / `X-Dev-User-Id` headers on every request. No real JWT validation happens. To manually reset auth state:

```js
// Run in browser console
localStorage.removeItem('dev_tenant_id');
localStorage.removeItem('dev_user_id');
localStorage.removeItem('dev_user_role');
localStorage.removeItem('dev_user_name');
localStorage.removeItem('dev_tenant_name');
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

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/v1/auth/local/login` | None | Local dev login: cross-tenant email lookup (rate-limited, `AUTH_MODE=local` only) |
| POST | `/v1/auth/local/verify` | None | Local dev password verify (rate-limited, `AUTH_MODE=local` only) |
| POST | `/v1/auth/cognito/lookup` | None | Cognito email→username lookup (rate-limited, `AUTH_MODE=cognito` only) |

### Tenants + Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/v1/tenants` | None | Signup: create tenant + owner user |
| GET | `/v1/tenants/me` | Required | Get current tenant |
| GET | `/v1/users/me` | Required | Get current user |
| GET | `/v1/tenants/me/settings` | Required | Get business settings (null if not configured) |
| PUT | `/v1/tenants/me/settings` | Required | Create or update business settings |
| GET | `/v1/users` | Required | List team members |
| POST | `/v1/users` | Required | Create/invite user (owner/admin only) |
| POST | `/v1/users/:id/reset-password` | Required | Reset user password (owner/admin only) |
| POST | `/v1/users/me/password` | Required | Change own password |

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

### Jobs

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/v1/jobs` | Required | List jobs (`?search=`, `?status=`, `?cursor=`) |
| GET | `/v1/jobs/count` | Required | Count jobs (`?status=`) |
| GET | `/v1/jobs/by-quote/:quoteId` | Required | Get job by source quote |
| POST | `/v1/jobs` | Required | Create job from approved quote (idempotent) |
| GET | `/v1/jobs/:id` | Required | Get job with embedded visits |

### Visits

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/v1/visits` | Required | List visits by date range (`?from=`, `?to=`, max 8 days) |
| GET | `/v1/visits/unscheduled` | Required | List unscheduled visits |
| PATCH | `/v1/visits/:id/schedule` | Required | Schedule or reschedule a visit |

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
| `COGNITO_USER_POOL_ID` | _(none)_ | Required when `AUTH_MODE=cognito` |
| `COGNITO_CLIENT_ID` | _(none)_ | Required when `AUTH_MODE=cognito` |
| `COGNITO_REGION` | _(none)_ | Required when `AUTH_MODE=cognito` |

## AI Context

This repo uses `CLAUDE.md` as an AI context index. It points to 10 context packs in `docs/context/` covering architecture, UI/UX, testing, security, observability, conventions, data access, domain model, and API standards. AI agents should read `CLAUDE.md` first before making design or implementation decisions.
