# Seedling HQ

Seedling HQ is a field service management platform for small businesses — lawn care, tree service, landscaping, cleaning, and similar trades. It helps owners manage the full lifecycle from incoming service requests through quoting, scheduling, and job completion.

Built as a multi-tenant SaaS with two access models:
- **Internal users** (owners, admins, and technicians) log in via the web app
- **External customers** receive secure links to view and approve quotes — no login required

## What's Built So Far

| Feature | Description |
|---------|-------------|
| Signup + onboarding | Create a business account, configure profile, hours, and service defaults |
| Login + auth | Email/password login with account picker; AuthGuard on all protected routes; AWS Cognito for production |
| Service catalog | Two-level catalog (categories and items) with pricing in dollars |
| Client management | Client records with properties (service addresses), searchable, with activity timeline |
| Public request form | Embeddable form for customers to request service — honeypot + rate limiting |
| Request notifications | Email alerts to the business owner when new requests arrive (Mailpit for local dev) |
| Request conversion | Convert incoming requests into clients, properties, and draft quotes atomically |
| Quote builder | Inline line-item editor with service picker, tax, auto-totals; standalone or from request |
| Send quotes via secure link | One-click send generates a time-limited, HMAC-hashed secure link |
| Customer approves/declines | Customers approve or decline quotes from the secure link; idempotent |
| Team management | Invite members, assign roles (owner/admin/member), reset passwords, change own password |
| Jobs + visits | Approved quotes create jobs with visits; job list with status filters and search |
| Schedule calendar | Week/day calendar view, schedule/reschedule visits, assign technicians |
| Today page | Mobile-first daily view for technicians — visit status transitions, contact links |
| Visit notes + photos | Add notes and upload photos to visits; S3-backed photo storage with presigned POST |
| Completion confirmation | "Any notes or photos to add?" prompt before completing a visit |
| **Invoicing + payments** | **Planned** — Invoice generation, Stripe payments via secure link |

## Prerequisites

- **Node.js 24** (see `.nvmrc`)
- **pnpm 9** — `corepack enable && corepack prepare pnpm@9.15.4 --activate`
- **Docker** — runs Postgres, Mailpit (local email), and LocalStack (local S3)

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url> && cd Seedling-HQ
pnpm i

# 2. Set up environment
cp .env.example .env

# 3. Start Docker services, push DB schema, seed demo data
make deps

# 4. Start the app (API on :4000, Web on :5173)
pnpm dev
```

Once running, open:

| URL | What |
|-----|------|
| http://localhost:5173/login | Login page — `owner@demo.local` / `password` |
| http://localhost:5173/dashboard | Dashboard with metric cards |
| http://localhost:5173/today | Today page — technician daily view |
| http://localhost:4000/docs | Swagger UI — browse and test all API endpoints |
| http://localhost:8025 | Mailpit — captured emails (notifications, quote sends) |

## Demo Walkthrough

The seed data creates a ready-to-explore demo tenant with 3 clients, 3 requests, 4 quotes, jobs with visits, and 3 team members (Demo Owner, Demo Admin, Demo Member). After `make deps` and `pnpm dev`:

1. **Dashboard** — metric cards for clients, requests, quotes
2. **Services** — Lawn Care, Tree Service, and Landscaping categories with 8 service items
3. **Clients** — John Smith, Jane Johnson, Bob Wilson — each with a property and activity timeline
4. **Requests** — 3 incoming requests from the public form, all "New"
5. **Quotes** — 1 draft, 2 sent, 1 scheduled (with secure links you can follow)
6. **Schedule** — week calendar with scheduled visits; unscheduled panel; assign technicians from the modal
7. **Today** — daily view showing visits with status actions, phone/email/map links, notes, and photos
8. **Jobs** — jobs created from approved quotes, each with visits; add notes and photos from job detail
9. **Team** — role badges, invite new members, reset passwords

**Try the full flow:**
1. Submit a request at http://localhost:5173/request/demo
2. Check the email in Mailpit (http://localhost:8025)
3. Open the request in the app → "Convert to Client"
4. Edit the draft quote — add line items, set pricing
5. "Send Quote" → copy the secure link → open in incognito
6. Approve the quote → creates a job with a visit
7. Go to **Schedule** → click the unscheduled visit → set date/time + assign a technician
8. Go to **Today** → start the visit → add notes and photos → complete it

**Demo accounts** (all password: `password`):

| Email | Role | Notes |
|-------|------|-------|
| `owner@demo.local` | Owner | Full access to everything |
| `admin@demo.local` | Admin | Can manage team + assign visits |
| `member@demo.local` | Member | Technician — sees own assigned visits on Today |

## Project Structure

```
Seedling-HQ/
  apps/api/              Fastify 5 backend (Clean Architecture)
  apps/web/              React 19 + Vite frontend
  packages/shared/       Shared TypeScript types (AuthContext)
  e2e/                   Playwright E2E tests
  infra/cdk/             AWS CDK stacks (standalone workspace — see note below)
  infra/localstack/      LocalStack init scripts (S3 bucket + CORS)
  scripts/               Dev helper scripts (status, stop, mailpit clear)
  docs/context/          Architecture & design context packs (10 files)
  docs/stories/          Story implementation plans and checklists
```

> **CDK is a standalone workspace.** `infra/cdk/` is NOT part of pnpm workspaces. To install its dependencies, run `cd infra/cdk && pnpm install --ignore-workspace`.

### Backend (Clean Architecture)

```
apps/api/src/
  domain/          Entities (14): tenant, user, client, property, request, quote,
                   job, visit, visit-photo, service-category, service-item,
                   business-settings, message-outbox, secure-link-token
  application/     Use cases, ports (20 repository interfaces), DTOs
  adapters/http/   Route handlers, auth middleware, external token middleware
  infra/           Drizzle repositories, Cognito auth, email sender, S3 storage
  shared/          Errors, config, logging, crypto utilities
```

Dependencies point inward: `infra → application → domain`. Route handlers validate input via Zod and call use cases. Use cases enforce business rules and call repository ports. Infrastructure implements those ports with Drizzle ORM, AWS SDKs, etc.

### Frontend

```
apps/web/src/
  app-shell/       Sidebar, TopBar, MobileDrawer (responsive nav)
  pages/           22 page components (one per route)
  components/
    ui/            Base UI components (Button, Input, Card, Dialog, etc.)
    visits/        PhotoUpload, PhotoGallery, visit-specific components
    quotes/        QuoteLineItems, ServiceItemPicker
    schedule/      WeekCalendar, ScheduleVisitModal
    clients/       ClientList, PropertyForm
    team/          InviteMemberForm, ResetPasswordDialog
    ...            Other feature-specific component directories
  lib/             API client, auth (dual-mode local/cognito), utilities
```

Built with React 19, Vite 6, Tailwind CSS v4, and TanStack Query. Responsive layout with sidebar on desktop and slide-out drawer on mobile.

**Route structure:** Public routes (`/login`, `/signup`, `/request/:slug`, `/quote/:token`) are outside the app shell. All other routes are wrapped in `AuthGuard` + `AppShell`. Unknown routes redirect to `/login`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | pnpm workspaces, Node 24 |
| API | Fastify 5, Zod validation, Pino logging |
| Database | PostgreSQL 17, Drizzle ORM |
| Frontend | React 19, Vite 6, Tailwind CSS v4, TanStack Query |
| Testing | Vitest (unit + integration), Playwright (E2E), axe-core (a11y) |
| Auth | AWS Cognito (production), `AUTH_MODE=local` with scrypt password hashing (dev) |
| Email | Nodemailer + Mailpit (local), SES (planned) |
| Object Storage | AWS S3 + LocalStack (local), presigned POST for uploads |
| Infra | Docker Compose (local), AWS CDK (Cognito deployed) |

## Development

### Common Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start API (:4000) + Web (:5173) with hot reload |
| `pnpm build` | Build all packages |
| `pnpm test` | Run all unit tests (API + web) |
| `pnpm test:integration` | Run integration tests (requires Postgres) |
| `pnpm test:e2e` | Run Playwright E2E tests (auto-starts servers) |
| `pnpm gen` | Regenerate OpenAPI spec from route schemas |
| `pnpm typecheck` | Type-check all packages |
| `pnpm services:up` | Start Docker services (Postgres, Mailpit, LocalStack) |
| `pnpm services:down` | Stop Docker services |
| `pnpm services:logs` | Tail Docker service logs |
| `pnpm db:push` | Apply Drizzle schema to database |
| `pnpm db:seed` | Seed demo data |
| `pnpm db:reset` | Truncate all tables |

### Makefile Shortcuts

| Target | Description |
|--------|-------------|
| `make deps` | Full setup: Docker up → wait for Postgres → push schema → seed data |
| `make deps-up` | Start Docker services only |
| `make deps-down` | Stop Docker services |
| `make deps-reset` | Wipe volumes and re-setup from scratch |

### Helper Scripts

| Script | Description |
|--------|-------------|
| `bash scripts/dev-start.sh` | Full cold start: Docker up, wait for health, push schema, seed, start dev servers |
| `bash scripts/dev-stop.sh` | Gracefully stop API, Vite, and Docker services |
| `bash scripts/dev-status.sh` | Colorized dashboard showing status of all services and ports |
| `bash scripts/dev-reset-db.sh` | Reset DB to clean state without stopping servers |
| `bash scripts/dev-open.sh` | Open login, Swagger, and Mailpit in browser |
| `bash scripts/dev-logs.sh` | Tail Docker logs (all services, or pass `postgres`/`localstack`/`mailpit`) |
| `bash scripts/s3-ls.sh` | List LocalStack S3 bucket contents (optional prefix filter) |
| `bash scripts/test-all.sh` | Run unit + integration + E2E in sequence (pass `--continue` to skip early exit) |
| `bash scripts/mailpit-clear.sh` | Clear all emails from Mailpit inbox |

### Docker Services

Three services run via Docker Compose:

| Service | Ports | Purpose |
|---------|-------|---------|
| **Postgres 17** | 5432 | Database (user: `fsa`, password: `fsa`, db: `fsa`) |
| **Mailpit** | 1025 (SMTP), 8025 (Web UI) | Local email capture for notifications |
| **LocalStack** | 4566 | Local S3 for photo uploads (auto-creates `seedling-uploads` bucket) |

All three have health checks configured. Postgres data persists in a Docker volume (`pgdata`).

### Database

Schema is managed by Drizzle ORM. In local dev, use `db:push` to apply schema changes directly. In production, use `db:generate` + `db:migrate` for migration files.

To restore a clean database:

```bash
pnpm db:reset && pnpm db:push && pnpm db:seed
```

**15 tables:** tenants, users, audit_events, business_settings, service_categories, service_items, clients, properties, requests, message_outbox, quotes, secure_link_tokens, jobs, visits, visit_photos

### Testing

Three test tiers:

```
Unit:        408 tests (332 API + 76 web)
Integration: 260 tests (real Postgres, mocked external services)
E2E:         182 tests (117 run + 65 skipped; full stack with Playwright)
```

Run a single test:

```bash
# Unit test
pnpm --filter @seedling/api exec vitest run test/unit/create-quote.test.ts

# Integration test
pnpm --filter @seedling/api exec vitest run --config vitest.integration.config.ts test/integration/quote-routes.test.ts

# E2E test (single spec, single browser)
pnpm exec playwright test e2e/tests/quotes.spec.ts --project=desktop-chrome
```

**E2E setup:** The global setup automatically runs `db:reset → db:push → db:seed` before each test run. Photo-related E2E tests are skipped if LocalStack is not running. E2E tests run against both `desktop-chrome` and `mobile-chrome` viewports — many tests are skipped on mobile (tagged `desktop only`).

**Integration tests** use `pool: 'forks'` + `singleFork: true` in vitest to share a single DB connection across tests.

## Roles and Permissions

Three roles with hierarchical permissions:

| Role | Can manage team | Can assign visits | Can cancel visits | Today page |
|------|----------------|-------------------|-------------------|------------|
| **Owner** | Yes (all users) | Yes | Yes | Sees own visits |
| **Admin** | Yes (members only) | Yes | Yes | Sees own visits |
| **Member** | No | No | No | Sees own assigned visits only |

All roles can view clients, quotes, jobs, and schedules. Members can only transition their own assigned visits (start, complete) — they cannot cancel.

## Multi-Tenancy

Every database query is scoped by `tenant_id`. The same email address can exist in different tenants. Cross-tenant access is denied at the repository level — there's no way to accidentally query another tenant's data.

### Auth

**Local dev** (`AUTH_MODE=local`): Login page at `/login` with email + password. Password is verified via scrypt hash against the database. If an email is associated with multiple tenants, an account picker appears.

**Production** (`AUTH_MODE=cognito`): AWS Cognito User Pool with JWT validation. The frontend uses `amazon-cognito-identity-js` for the auth flow. Tokens are stored in sessionStorage.

Under the hood, local dev stores auth state in `localStorage` and sends `X-Dev-Tenant-Id` / `X-Dev-User-Id` headers. To manually reset:

```js
// Browser console
localStorage.removeItem('dev_tenant_id');
localStorage.removeItem('dev_user_id');
localStorage.removeItem('dev_user_role');
localStorage.removeItem('dev_user_name');
localStorage.removeItem('dev_tenant_name');
location.reload();
```

### Secure Links (External Access)

Customers access quotes via secure links like `http://localhost:5173/quote/<token>`. These tokens are:
- Hashed with HMAC-SHA256 before storage (raw token is never persisted)
- Scoped to a specific object and action (e.g., "read and respond to this quote")
- Time-limited (14 days default, configurable 1-90)
- Revocable

### Photo Uploads

Visit photos are stored in S3 (LocalStack locally). The upload flow uses presigned POST policies:

1. Frontend calls `POST /v1/visits/:visitId/photos` → gets a presigned POST URL + form fields
2. Frontend uploads the file directly to S3 using the presigned POST (10MB max, enforced server-side)
3. Frontend calls `POST .../photos/:photoId/confirm` to mark the photo as ready
4. Photos are listed via presigned GET URLs (1-hour expiry)

Stale pending uploads are automatically cleaned up after 15 minutes (self-healing). Max 20 ready photos per visit.

## API Endpoints

All endpoints are browsable via Swagger UI at http://localhost:4000/docs.

### System

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Health check |

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/v1/auth/local/login` | None | Email lookup, returns matching accounts (rate-limited, local mode only) |
| POST | `/v1/auth/local/verify` | None | Password verify (rate-limited, local mode only) |
| POST | `/v1/auth/cognito/lookup` | None | Email → Cognito username lookup (rate-limited, cognito mode only) |

### Tenants + Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/v1/tenants` | None | Signup: create tenant + owner user (disabled in cognito mode) |
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
| POST | `/v1/public/requests/:tenantSlug` | None | Submit public service request (honeypot + rate-limited) |
| GET | `/v1/requests` | Required | List requests (`?search=`, `?status=`, `?cursor=`) |
| GET | `/v1/requests/count` | Required | Count requests (`?status=new`) |
| GET | `/v1/requests/:id` | Required | Get request |
| POST | `/v1/requests/:id/convert` | Required | Convert to client + property + draft quote |

### Quotes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/v1/quotes` | Required | Create standalone draft quote for existing client |
| GET | `/v1/quotes` | Required | List quotes (`?search=`, `?status=`, `?cursor=`) |
| GET | `/v1/quotes/count` | Required | Count quotes (`?status=`) |
| GET | `/v1/quotes/:id` | Required | Get quote with line items |
| PUT | `/v1/quotes/:id` | Required | Update quote (draft only) |
| POST | `/v1/quotes/:id/send` | Required | Send quote via secure link (returns link URL) |
| GET | `/v1/ext/quotes/:token` | Secure link | View quote (customer-facing, no login) |
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
| GET | `/v1/visits` | Required | List by date range (`?from=`, `?to=`, `?assignedUserId=`, max 8 days) |
| GET | `/v1/visits/unscheduled` | Required | List unscheduled visits (`?assignedUserId=`) |
| PATCH | `/v1/visits/:id/schedule` | Required | Schedule or reschedule a visit |
| PATCH | `/v1/visits/:id/assign` | Required | Assign/unassign technician (owner/admin only) |
| PATCH | `/v1/visits/:id/status` | Required | Transition status (en_route/started/completed/cancelled) |
| PATCH | `/v1/visits/:id/notes` | Required | Update notes (en_route/started/completed only) |

### Visit Photos

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/v1/visits/:visitId/photos` | Required | Create photo record + get presigned S3 upload POST |
| POST | `/v1/visits/:visitId/photos/:photoId/confirm` | Required | Confirm upload (pending → ready) |
| GET | `/v1/visits/:visitId/photos` | Required | List ready photos with presigned download URLs |
| DELETE | `/v1/visits/:visitId/photos/:photoId` | Required | Delete photo (DB + S3) |

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
| `SECURE_LINK_HMAC_SECRET` | `dev-secret-...` | HMAC secret for token hashing (**change in production**) |
| `S3_BUCKET` | `seedling-uploads` | S3 bucket for photo uploads |
| `S3_REGION` | `us-east-1` | S3 region |
| `S3_ENDPOINT` | `http://localhost:4566` | LocalStack endpoint (empty = real AWS) |
| `COGNITO_USER_POOL_ID` | _(none)_ | Required when `AUTH_MODE=cognito` |
| `COGNITO_CLIENT_ID` | _(none)_ | Required when `AUTH_MODE=cognito` |
| `COGNITO_REGION` | _(none)_ | Required when `AUTH_MODE=cognito` |

## Architecture Notes

For deeper context, see the 10 context packs in `docs/context/`:

| Doc | Topic |
|-----|-------|
| Architecture & dev sandbox | System overview, naming conventions, local dev contract, CDK |
| UI/UX | Responsive strategy, component inventory, screen patterns, a11y |
| Testing | Test pyramid, TDD workflow, tenancy invariants |
| Security | Auth, secure links, PII redaction, audit |
| Observability | Correlation IDs, structured logging, audit events |
| DevEx & conventions | Layer boundaries, feature-building rails |
| Data access & tenancy | Tenant-safe repos, indexes, S3 keying |
| Domain model | Entities, status machines, audit event catalog |
| API standards | Error shapes, pagination, idempotency |
| Context gaps | Remaining undocumented areas (CI/CD, automation, comms) |

This repo uses `CLAUDE.md` as an AI context index. AI agents should read it before making design or implementation decisions.
