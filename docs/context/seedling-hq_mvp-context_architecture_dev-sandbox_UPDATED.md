# Seedling-HQ — MVP Context, Architecture, Naming, Dev Sandbox, and Customer Model (Single Source of Truth)

_Last updated: 2026-02-11 (America/Chihuahua)_

> This document updates the prior “MVP Context, Architecture, Naming, and Dev Sandbox” file to include:
> - Two customer types (internal vs external) and how that impacts tenancy
> - Secure-link token requirements for external customer access
> - Story updates / AC addendum guidance for secure-link surfaces

---

## 1) What we’re building

**Seedling-HQ** is a Jobber competitor for **very small → small businesses** (typically 1–5 users, sometimes 10–20).

### Business objectives
- MVP must deliver **real “admin offload”** (scheduling, quoting, invoicing, reminders, comms).
- Be **cost-competitive** early.
- Plan for growth from **~1,000 → 10,000 users** in ~1 year (usage across all US time zones; unpredictable peak windows).

---

## 2) MVP “spine” (end-to-end flow)

1) Lead / request intake  
2) Convert request → quote  
3) Customer approves quote  
4) Create job + schedule visit(s)  
5) Tech completes visit (notes/photos)  
6) Generate invoice  
7) Customer pays online  
8) Customer portal (“Client Hub”) via secure link to view/pay/appointments  
9) **Automation + reminders + outbound-only SMS (non-negotiable)**

---

## 3) Hard requirements / constraints

### Platform
- AWS-first (stay “inside AWS walls” unless major cost savings elsewhere).
- TypeScript everywhere.
- **Spec-driven development** using OpenAPI/Swagger.
- Frontend: React + Vite (CSR for MVP; marketing/SEO later).
- Backend: Fastify on AWS Lambda initially.
- All new functionality MUST support **local-first development**.

### Communications
- SMS is a must for MVP.
- **Outbound-only** (no two-way SMS in MVP).
- Prefer AWS-native SMS in prod (AWS End User Messaging SMS v2).
- Local/dev can run “outbox provider mode”.

### Work management
- Kanban board; each story is a **vertical slice** with explicit local demo steps.

---

## 4) Current technical architecture (Lambda-first, container-ready)

### High-level
- **Web app**: React + Vite static app
  - AWS deploy (future): S3 + CloudFront
  - Local: Vite dev server
- **API**: Fastify (TypeScript) deployed to Lambda behind API Gateway (HTTP API)
  - Local: runs as normal Node server
  - Swagger UI at `/docs`
  - Route prefixes:
    - `/v1/*` — authenticated internal routes (Cognito JWT or local mock)
    - `/v1/public/*` — unauthenticated public routes (S-0006+)
    - `/v1/ext/*` — external token-authenticated routes (S-0010+); token derived from URL param, validated via HMAC hash lookup against `secure_link_tokens` table
- **Contract-first**:
  - Fastify route schemas → OpenAPI JSON → generated TS client/types
- **Data**: Postgres system-of-record (multi-tenant)
- **Files**: S3 for uploads/attachments (presigned URL uploads)
- **Async + automation**:
  - SQS for background work
  - EventBridge bus for domain events (optional early, useful later)
  - EventBridge Scheduler for delayed reminders (Scheduler → SQS → worker)
- **Comms**:
  - Email: SES in prod; Mailpit locally
  - SMS: AWS End User Messaging SMS v2 in prod; local outbox mode
- **Secrets**: Secrets Manager (or SSM Parameter Store)
- **Observability**: CloudWatch logs/metrics + structured logs with correlation/request IDs

### Logical diagram
```mermaid
flowchart LR
  U[Users] --> CF[CloudFront]
  CF --> S3W[S3 (Web assets)]
  CF --> APIGW[API Gateway (HTTP API)]
  APIGW --> LAPI[Lambda: Fastify API]

  LAPI --> RDS[(Postgres: RDS/Aurora)]
  LAPI --> S3F[S3: uploads]
  LAPI --> EB[EventBridge Bus]
  LAPI --> SQSMSG[SQS: message jobs]
  LAPI --> SQSDOM[SQS: domain events]

  EB --> SQSDOM
  SCH[EventBridge Scheduler] --> SQSMSG

  SQSMSG --> LWRK[Lambda: Worker]
  LWRK --> RDS
  LWRK --> SMS[Outbound SMS]
  LWRK --> SES[Outbound Email]
  LWRK --> S3F
```

### 4.1 Authentication — AWS Cognito (internal users)

**Decision:** Internal user authentication uses **AWS Cognito User Pools** (JWT-based). This resolves the open question previously tracked in Section 15F.

#### Cognito architecture
- **One Cognito User Pool per environment** (dev-sandbox, staging, prod).
- **Custom attribute:** `custom:tenant_id` (required, immutable after creation). This is the tenancy binding — the JWT carries the tenant identity.
- **Cognito Groups** map to application roles: `owner`, `admin`, `member`. The `cognito:groups` claim appears in the Access token.
- **App Client:** single client per pool, configured for **PKCE flow** (no client secret; SPA-safe).
- **Login UI:** custom React login page using Cognito SDK (`amazon-cognito-identity-js` or Amplify Auth). Cognito is a backend-only identity provider — we do **not** use the Hosted UI.

#### Token flow
```mermaid
sequenceDiagram
  participant App as React App
  participant Cog as Cognito
  participant API as Fastify API

  App->>Cog: authenticate (PKCE)
  Cog-->>App: ID token + Access token + Refresh token
  App->>API: request + Authorization: Bearer <access_token>
  API->>API: validate JWT (JWKS, cached)
  API->>API: extract authContext { tenant_id, user_id, role }
  API-->>App: response
```

- React app authenticates via Cognito SDK; receives ID token, Access token, and Refresh token.
- React app sends **Access token** as `Authorization: Bearer <token>` on API requests.
- API middleware validates JWT signature using Cognito JWKS endpoint (via `jose` library, `createRemoteJWKSet` with auto-caching), checks `iss`, `client_id` (NOT `aud` — Cognito access tokens use `client_id`), `exp`, `token_use=access`. **Implemented in S-0029.**
- A **pre-token-generation V2 Lambda trigger** (CDK, S-0029) copies `custom:tenant_id` from user attributes into the access token, enabling access-token-only validation (security best practice).
- Middleware extracts `authContext`:
  ```
  { principal_type: "internal", tenant_id (custom:tenant_id), user_id (username, NOT sub), role (cognito:groups — exactly one) }
  ```
- **Contract:** Cognito `username` must equal `users.id` from the database. This is enforced at user provisioning time (future story), not at JWT validation time.
- React app stores tokens in `sessionStorage` via a custom `ICognitoStorage` adapter (`cognito-storage.ts`). Do not use cookies or `localStorage` (persists too long). `sessionStorage` survives page refresh but clears on tab close. **Implemented in S-0030.**

#### AUTH_MODE switch (local dev)
- `AUTH_MODE=cognito` — dev-sandbox, staging, prod: real JWT validation via JWKS.
- `AUTH_MODE=local` — local dev: mock middleware produces the identical `authContext` shape without requiring a real Cognito pool.
  - **Default identity** from env vars:
    - `DEV_AUTH_TENANT_ID` (default: a seeded dev tenant UUID)
    - `DEV_AUTH_USER_ID` (default: a seeded dev user UUID)
    - `DEV_AUTH_ROLE` (default: `owner`)
  - **Per-request override** via headers (added in S-0002):
    - `X-Dev-Tenant-Id` — overrides `DEV_AUTH_TENANT_ID` for this request
    - `X-Dev-User-Id` — overrides `DEV_AUTH_USER_ID` for this request
    - The frontend stores tenant/user IDs in `localStorage` after login or signup and sends them as headers on all subsequent requests.
  - **Login page** (added in S-0027, updated in S-0030):
    - `POST /v1/auth/local/login` — cross-tenant email lookup (joins users + tenants, case-insensitive via `lower()`); returns 404 when `AUTH_MODE !== 'local'`; rate-limited (10 req/min per IP)
    - Frontend `LoginPage` at `/login` — dual-mode step machine (`login` → `accounts` → `new-password`):
      - **Login step:** combined email + password form → lookup email → if single account: authenticate immediately → if multiple: show accounts step
      - **Accounts step:** account picker → authenticate with already-entered password
      - **Local mode:** `authenticate()` calls `POST /v1/auth/local/verify` for real password check
      - **Cognito mode:** `authenticate()` calls SDK `authenticateUser` → may trigger NEW_PASSWORD_REQUIRED challenge → inline password-change form
    - `AuthGuard` wraps all authenticated routes — uses `useAuth()` context (not direct localStorage), redirects to `/login` if not authenticated
    - Logout buttons in Sidebar + MobileDrawer call `useAuth().logout()` which clears storage + React Query cache and redirects to `/login`
  - **Cognito lookup endpoint** (added in S-0030): `POST /v1/auth/cognito/lookup` — same cross-tenant email lookup, returns `cognitoUsername` (= `users.id`); returns 404 when `AUTH_MODE !== 'cognito'`; rate-limited (10 req/min per IP)
  - **Tenant creation gate** (added in S-0030): `POST /v1/tenants` returns 404 when `AUTH_MODE=cognito` (self-signup disabled; users must be admin-provisioned)
  - **Frontend auth** (added in S-0030): `AuthProvider` context (`auth-context.tsx`) + `useAuth()` hook provide dual-mode auth state. `api-client.ts` uses `setAuthProvider()` to inject `Authorization: Bearer <token>` in cognito mode with 401 retry (forceRefresh → retry → onAuthFailure → logout). `SignupPage` shows "Contact your administrator" in cognito mode.
  - The `AuthContext` interface is **identical** in both modes — use cases and domain logic never know which mode produced it.
  - The mock middleware must refuse to activate if `NODE_ENV=production`.

#### External auth is unchanged
External customers continue to use **loginless secure-link tokens** (see Sections 6.2 and 7.2). Cognito is only for internal principals.

---

## 5) Local development contract (as shipped)

### Standard commands (repo root)
- `pnpm i`
- `make deps`
- `pnpm gen`
- `pnpm dev`

### Local endpoints
- Web: `http://localhost:5173`
- API: `http://localhost:4000`
- Swagger UI: `http://localhost:4000/docs`
- Mailpit: `http://localhost:8025`
- LocalStack: `http://localhost:4566`

### Definition of Done (for every story)
- OpenAPI schemas added/updated
- Generated contract + client types updated (`pnpm gen`)
- End-to-end local demo works (including async paths if relevant)
- If DB changes: migrations applied locally

---

## 6) Two customer types (internal vs external)

Seedling-HQ has two “customer” concepts:

1) **Internal customers**: the businesses that use Seedling-HQ (they pay you)
2) **External customers**: the customers of those businesses (called **Clients** in the product)

### 6.1 Tenancy definition (important)
- **Tenant = internal customer (business using Seedling-HQ).**
- External customers are **tenant-owned data** (clients, contacts, properties, requests, quotes, invoices, etc.), not tenants.

**Rule of thumb:**  
> If the business is paying Seedling-HQ, it is the tenant. Everyone and everything else belongs to that tenant.

### 6.2 Principals (who can act) vs tenants (who owns data)
You have at least **two principal types**:

**A) Internal principals (Seedling users)**
- Owners/office staff/members that log into Seedling-HQ.
- Auth context includes: `tenant_id`, `user_id`, `role`.
- Authorization style: tenant-scoped RBAC.

**B) External principals (client/customer access)**
- MVP uses **loginless secure links** (quote approval, invoice pay, client hub).
- Authorization style: **token-scoped**.

A token-derived auth context should include:
- `tenant_id`
- `subject_type` (e.g., `quote`, `invoice`, `client_hub`)
- `subject_id` (the object they can access)
- `scopes` (e.g., `quote:read`, `quote:respond`, `invoice:pay`, `hub:read`)
- `expires_at`, `revoked_at` (and optional `last_used_at`)

---

## 7) Multi-tenancy baseline rules (updated)

**Non-negotiable isolation boundaries**
- Every table: `tenant_id` present where applicable.
- API must enforce tenant scope on **every** read/write path.
- All storage keys in S3 should be prefixed by tenant (and often by object type + id).
- External-customer access must never accept `tenant_id` from request params; derive tenant from auth context only.

### 7.1 External customers are never global
Even if two tenants have the same name/email/phone:
- treat them as **separate client records** per tenant.

Avoid global uniqueness constraints on PII unless intentionally designed.

### 7.2 Secure link tokens must be tenant-bound (critical)
**This is the #1 pitfall with “customers of customers”.**

Every secure link should resolve to something like:

`token -> (tenant_id, subject_type, subject_id, scopes, expires_at, revoked_at)`

And every handler must enforce:
- DB queries use `tenant_id` from token
- accessed object matches `subject_id` (or strict relationship)
- token scope allows the action

**Recommendation:** store only a **hash** of the token (never plaintext).

### 7.3 Recommended shared primitive: secure link tokens
To avoid 3 separate “token systems” (quotes, invoices, hub), implement one shared token primitive.

Suggested table (name is up to you, e.g., `secure_link_tokens`):
- `tenant_id`
- `token_hash`
- `subject_type`
- `subject_id`
- `scopes` (text[] or jsonb)
- `expires_at`
- `revoked_at`
- optional: `created_by_user_id`, `created_at`
- optional: `last_used_at`, `last_used_ip`, `user_agent`

---

## 8) MVP epics & stories (R1 snapshot + secure-link AC updates)

**Epic 0001 — Multi-tenant setup + onboarding**
- S-0001 Business signup + first tenant (tenant enforcement, owner role, demo seed) **— DONE**
- S-0002 Onboarding wizard (business profile/settings) **— DONE**: singleton `business_settings` table (JSONB hours), GET/PUT `/v1/tenants/me/settings`, 4-step wizard + quick-setup form, settings edit page
- S-0003 Service catalog (price book v1) **— DONE**: two-level catalog (categories → items), soft delete via `active` flag, prices in integer cents, unit types (flat/hourly/per_sqft/per_unit/per_visit), CRUD routes at `/v1/services/categories` and `/v1/services`

**Epic 0002 — CRM (clients + properties)**
- S-0004 Client + property creation (search + notes) **— DONE**: two-level model (clients → properties), cursor-based pagination, server-side ILIKE search, soft delete with cascade, nested + flat URL pattern
- S-0005 Client timeline (activity feed v1) **— DONE**: timeline via `audit_events` query with composite index, tab layout (Info/Properties/Activity), event label mapping, exclude filter

**Epic 0003 — Requests (lead intake)**
- S-0006 Public request form (spam protection baseline: honeypot + rate limit) **— DONE**: public endpoint `/v1/public/requests/:tenantSlug`, honeypot + in-memory rate limiter, tenant resolution via slug, system audit principal
- S-0007 New request notifications (email + optional outbound SMS via worker) **— DONE**: message outbox pattern, Nodemailer → Mailpit (local SMTP), best-effort notification, SMS queued for S-0021 worker
- S-0008 Convert request → client + property + quote draft **— DONE**: atomic cross-entity conversion in single UoW, extended TransactionRepos (7 repos), race-guarded `updateStatus`, existing client match on convert

**Epic 0004 — Quotes + approvals**
- S-0009 Quote builder v1 (totals, draft/send states) **— DONE**: quote detail page with line-item editing, totals calculation, status machine (draft→sent→approved/declined/expired), quote list page with filters
- S-0010 Send secure quote link (token access, audit events) **— DONE**: shared `secure_link_tokens` table + HMAC token generation, `/v1/ext/*` route prefix with token-scoped auth middleware, send-quote use case creates token + sends email with link, audit events for send/view
- S-0011 Customer approves quote **— DONE**: `RespondToQuoteUseCase` (approve/decline), token scope `quote:respond`, idempotent external actions (same-action → 200 no-op, cross-transition → 400), `principalType: 'external'` audit events, owner notification via outbox

**Epic 0005 — Scheduling (jobs + visits)**
- S-0012 Approved quote creates Job + first Visit draft
- S-0013 Calendar view (schedule/reschedule) + customer notified
- S-0014 Assign technician to visit + tech sees “My visits”

**Epic 0006 — Field execution (mobile-web v1)**
- S-0015 Tech “Today” view (mobile) + status actions
- S-0016 Complete visit with notes + photo uploads (S3 presigned URLs)

**Epic 0007 — Invoicing + payments**
- S-0017 Generate invoice from completed visit + send link **→ updated AC: tenant-bound + invoice-bound token, audit**
- S-0018 Customer pays invoice online (webhook marks paid; receipt email) **→ updated AC: token scope `invoice:pay`, idempotent & tenant-safe webhook**
- S-0019 Basic AR dashboard (filters + reminder trigger)

**Epic 0008 — Client Hub (portal v1)**
- S-0020 Client Hub secure link (appointments + open invoices + pay) **→ updated AC: tenant-bound + client-bound hub token; hub queries scoped by (tenant_id, client_id)**

**Epic 0009 — Communications (Outbound SMS + Email)**
- S-0021 Outbox + worker (email + SMS), message_jobs queue, prefs, statuses

**Epic 0010 — Automation + reminders (MVP non-negotiable)**
- S-0022 Appointment reminders (Scheduler → SQS → worker)
- S-0023 Quote follow-up automation (24h/72h style cadence; cancel on approve/decline)
- S-0024 Invoice reminder automation (cadence; cancel on paid)

**Epic 0011 — Security baseline**
- S-0025 Public form abuse protection (MVP)

---

## 9) Communications (Outbound SMS + Email) — MVP design

### Pattern (durable + async for SMS; sync for email)
- `message_outbox` table is the source of truth for all outbound comms (implemented S-0007).
- **Email (S-0007):** Sent immediately via Nodemailer (Mailpit locally, SES in prod). Outbox record created as `queued`, then updated to `sent` or `failed` synchronously. Best-effort — errors are caught and logged, never block the request.
- **SMS (S-0021, queued only in S-0007):** Outbox record created as `queued`. Actual sending via SQS worker in S-0021.
- SQS `message-jobs` carries jobs like:
  - `{ type: "sms.send", tenant_id, message_id }`
- Worker (S-0021):
  - loads outbox row
  - checks recipient preferences/opt-in
  - sends via provider
  - updates status to `sent` / `failed`

### Delayed sends (reminders)
- EventBridge Scheduler targets SQS `SendMessage` at a future time.
- Same worker path handles "send now" and "send later".

### Local vs prod
- Local email: Nodemailer → Mailpit (port 1025, web UI at port 8025)
- Local SMS: `SMS_PROVIDER=outbox` (no real sending; update outbox for demos)
- Prod email: Nodemailer → SES (or direct SES SDK)
- Prod SMS: `SMS_PROVIDER=aws` using AWS End User Messaging SMS v2

---

## 10) Payments (MVP)

Payments handled via Stripe:
- Customer pays invoice online
- Stripe webhooks mark invoice Paid and send receipt email

Local demo options:
- Stripe CLI and/or mocked webhook route

---

## 11) GitHub tracking + importer notes

Repo: `Seedling-HQ` under a personal GitHub account.

Known importer issues:
1) Owner detection bug:
   - GraphQL query attempted both `user()` and `organization()` in one request; fails if org doesn’t exist.
   - Fix: detect owner type via REST (`GET /users/{login}`), then query GraphQL root `user` OR `organization`.
2) CLI token missing Projects scopes:
   - Required scopes: `read:project` (and usually `project`) plus `repo`.
   - Fix: `gh auth refresh -h github.com -s read:project,project,repo`

Typical import:
- `node import-seedling-mvp.mjs --owner TMShumway --repo Seedling-HQ --project-title "Seedling MVP" --create-project`

Note:
- Projects v2 API can add items and set fields but can’t create UI “views”.

---

## 12) Naming conventions (AWS)

### Template
`fsa-<env>-<owner>-<resource>`

Examples:
- `fsa-dev-tim-message-jobs`
- `fsa-dev-tim-domain-events`
- `fsa-dev-tim-bus`

### Resource naming guide
| Resource | Naming | Notes |
|---|---|---|
| S3 uploads bucket | `fsa-<env>-<owner>-uploads-<acct>` | include account id for global uniqueness |
| SQS queue | `fsa-<env>-<owner>-<name>` | keep under 80 chars |
| EventBridge bus | `fsa-<env>-<owner>-bus` | simple + predictable |
| Scheduler group | `default` or `fsa-<env>` | keep consistent across envs |
| Scheduler exec role | `fsa-<env>-<owner>-scheduler-role` | max 64 chars |

### Tags
Apply to all resources:
- `app=fsa`
- `env=<env>`
- `owner=<owner>`
- `ttl=<YYYY-MM-DD>` (dev-only optional)
- `cost-center=fsa` (optional)

---

## 13) Environment variables

### Local baseline
API:
- `API_PORT=4000`
- `DATABASE_URL=postgresql://fsa:fsa@localhost:5432/fsa`
- `NODE_ENV=development`
- `AUTH_MODE=local`  # mock auth for local dev; see Cognito section below

Web:
- `VITE_API_BASE_URL=http://localhost:4000`

Email / notifications (local sink via Mailpit):
- `NOTIFICATION_ENABLED=true` (feature toggle; set to `false` to disable all notifications)
- `SMTP_HOST=localhost`
- `SMTP_PORT=1025`
- `SMTP_FROM=noreply@seedling.local` (sender address for notification emails)

### Cognito (internal user auth)
- `AUTH_MODE=local` (local dev default — mock middleware, no Cognito dependency)
- `AUTH_MODE=cognito` (dev sandbox / staging / prod — real JWT validation)

For `AUTH_MODE=cognito`:
- `COGNITO_USER_POOL_ID=...`
- `COGNITO_CLIENT_ID=...`
- `COGNITO_REGION=...` (JWKS URL derived from region + pool ID at runtime)

For `AUTH_MODE=local`:
- `DEV_AUTH_TENANT_ID=...` (default: seeded dev tenant UUID)
- `DEV_AUTH_USER_ID=...` (default: seeded dev user UUID)
- `DEV_AUTH_ROLE=owner` (owner | admin | member)
- Optional per-request overrides via `X-Dev-Tenant-Id` / `X-Dev-User-Id` headers (frontend sends from localStorage after signup)

### Secure links (required as of S-0010)
- `SECURE_LINK_HMAC_SECRET=...` (required; HMAC key used to generate and validate token hashes; minimum 16 characters enforced in production (`loadConfig()` throws); 32+ bytes recommended for optimal security)
- `APP_BASE_URL=http://localhost:5173` (required; base URL for constructing secure link URLs sent to external customers)
- (Planned) `SECURE_LINK_TOKEN_TTL_SECONDS=604800` (7 days default; not yet configurable — TTL hardcoded in use case)
- (Planned) `SECURE_LINK_ROTATION_SALT=...` (versioned hash scheme — not yet implemented)

### SMS / queues / scheduler (MVP)
- `SMS_PROVIDER=outbox` (default local)
- `SMS_PROVIDER=aws` (dev sandbox / staging / prod)

For `SMS_PROVIDER=aws`:
- `SMS_ORIGINATION_IDENTITY=...`
Optional:
- `SMS_CONFIGURATION_SET=...`
- `SMS_TTL_SECONDS=3600`
- `SMS_MAX_PRICE=0.50`

Queue wiring:
- `SQS_MESSAGE_QUEUE_URL=...` (API immediate enqueue)
- `SQS_MESSAGE_QUEUE_ARN=...` (Scheduler target)

Scheduler wiring:
- `SCHEDULER_ROLE_ARN=...`
- `SCHEDULER_GROUP=default` (optional)

---

## 14) CDK Dev Sandbox (core MVP infra + outputs for `.env.dev`)

### What it provisions
- **Cognito User Pool + App Client (PKCE, no client secret) — Implemented (S-0028)**
  - Custom attribute: `custom:tenant_id` (immutable)
  - Groups: `owner`, `admin`, `member`
  - UUID username (not email); email required but not unique/alias
  - Self-signup disabled; password: 8+ chars, upper+lower+digit+symbol, 7-day temp
  - Token TTLs: access 1h, ID 1h, refresh 30d
  - `preventUserExistenceErrors: true`, `enableTokenRevocation: true`
  - `featurePlan: ESSENTIALS` (required for access token customization)
  - Pre-token-generation V2 Lambda trigger copies `custom:tenant_id` into access tokens (S-0029)
- (Planned) S3 uploads bucket
- (Planned) SQS: message jobs + DLQ, domain events + DLQ
- (Planned) EventBridge bus
- (Planned) Scheduler execution role with permission to `sqs:SendMessage` to message-jobs
- Outputs to paste into `.env.dev`

### Recommended folder structure
```
infra/cdk/
  bin/dev-sandbox.ts
  lib/dev-sandbox-stack.ts
  cdk.json
  package.json
  tsconfig.json
```

### Deploy (example)
From `infra/cdk/` (standalone workspace — not in pnpm-workspace.yaml):
```bash
cd infra/cdk
pnpm install --ignore-workspace
pnpm dlx aws-cdk@2 bootstrap
pnpm dlx aws-cdk@2 deploy --context env=dev --context owner=tim
```

### Paste outputs into `.env.dev` (example)
```dotenv
# Cognito (currently provisioned)
AUTH_MODE=cognito
COGNITO_USER_POOL_ID=us-east-1_AbCdEfGhI
COGNITO_CLIENT_ID=1a2b3c4d5e6f7g8h9i0j
COGNITO_REGION=us-east-1

# Planned (not yet provisioned by CDK)
# S3_UPLOADS_BUCKET=fsa-dev-tim-uploads-123456789012
# SQS_MESSAGE_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/fsa-dev-tim-message-jobs
# SQS_MESSAGE_QUEUE_ARN=arn:aws:sqs:us-east-1:123456789012:fsa-dev-tim-message-jobs
# SCHEDULER_ROLE_ARN=arn:aws:iam::123456789012:role/fsa-dev-tim-scheduler-role
# DOMAIN_EVENTS_QUEUE_URL=...
# DOMAIN_EVENTS_QUEUE_ARN=...
# EVENT_BUS_NAME=fsa-dev-tim-bus
```

### Code integration points
- API immediate enqueue uses: `SQS_MESSAGE_QUEUE_URL`
- API delayed schedule uses: `SQS_MESSAGE_QUEUE_ARN` + `SCHEDULER_ROLE_ARN`
- Worker provider selection uses: `SMS_PROVIDER` (+ `SMS_ORIGINATION_IDENTITY` in AWS mode)

---

## 15) Pitfalls, concerns, and review checklist (updated)

### A) Multi-tenant isolation pitfalls
- **Missed tenant filters** on reads (list/search endpoints are common offenders).
- **Cross-tenant token access** if secure-link tokens don’t bind to tenant and object id.
- **S3 keying mistakes** (ensure tenant prefix is always applied and never user-supplied directly).

**Review**: add tests that attempt cross-tenant access on every core entity type and all secure-link endpoints.

### B) Secure link sprawl (quote/invoice/hub)
If each surface implements its own token logic, you risk:
- inconsistent expiry rules
- inconsistent audit events
- inconsistent revocation behavior
- inconsistent hashing/validation

**Consider**: implement one shared secure-link token primitive used by quote/invoice/hub.

### C) Async + reminders correctness
Common failure modes:
- enqueue/schedule happens but DB write didn’t (or vice versa)
- retries cause duplicate sends
- reminders aren’t canceled properly after state changes

**Review**:
- outbox-first pattern everywhere
- idempotency rules in worker (`message_id` as dedupe key)
- deterministic cancellation keys for scheduled reminders

### D) Domain events wiring trap
If you create an EventBridge bus and a “domain events” SQS queue, but don’t add rules:
- nothing will route bus → queue

**Review**: explicitly decide “SQS-only MVP” vs “wire bus rules now”.

### E) Local vs dev-sandbox parity gaps
Hybrid mode (local code + real AWS messaging) is powerful but can cause:
- IAM surprises (Scheduler role, SQS permissions)
- region/account mismatches in copied env vars
- accidental sending in dev

**Consider**:
- “safe default” `SMS_PROVIDER=outbox`
- explicit guardrails before enabling real SMS
- budgets/alerts and TTL tags for dev resources

### F) Auth decision — RESOLVED (Cognito chosen)
**Decision:** AWS Cognito for internal user authentication.
- One User Pool per environment, with `custom:tenant_id` for tenant binding.
- Cognito Groups for role mapping (`owner`, `admin`, `member`).
- `AUTH_MODE=local` provides a mock middleware producing the same `authContext` shape for local dev.
- See **Section 4.1** for full architecture.
- The principal context model supports both internal RBAC (Cognito JWT) and external token scopes (secure links) as separate auth paths.

**Status:** Resolved. No remaining risk on auth approach.

### G) Postgres tenancy strategy
App-enforced `tenant_id` is fine, but you’ll want:
- consistent indexes on `(tenant_id, <entity_id>)`
- careful unique constraints (often need `(tenant_id, slug)` not just `slug`)
- migrations kept simple and repeatable

### H) Cost & operational concerns (MVP)
- Scheduler usage can grow quickly with per-visit reminders if you schedule many one-time jobs.
- SMS costs can surprise you without max price / spend alarms.
- SQS retries + DLQs need visibility and dashboards.

**Review**: add CloudWatch alarms + basic dashboards early for queues, DLQ depth, and worker error rate.
