# Key Design Decisions (Resolved)

> Reference catalog of architectural and design choices made during story implementation.
> Linked from [CLAUDE.md](../../CLAUDE.md).

| Decision | Choice | Story | Notes |
|----------|--------|-------|-------|
| Auth provider | AWS Cognito (User Pools, JWT) | Pre-S-0001 | `AUTH_MODE=local` mock for dev; see Architecture doc 4.1 |
| DB query layer | Drizzle ORM + drizzle-kit | S-0001 | Type-safe, SQL-like API, built-in migrations |
| Logging | Pino (structured JSON) | S-0001 | Config object, not instance (Fastify 5 requirement) |
| API framework | Fastify 5 + Zod schemas | S-0001 | `fastify-type-provider-zod` (NOT `@fastify/` scoped); `trustProxy: true` for correct `request.ip` behind proxies |
| Frontend | React 19 + Vite + Tailwind CSS v4 + shadcn/ui | S-0001 | `@tailwindcss/vite` plugin; hand-written components |
| Monorepo | pnpm workspaces, Node 24 | S-0001 | `--env-file=../../.env` for tsx scripts (no dotenv) |
| Testing | Vitest + Playwright + axe-core | S-0001 | |
| DB schema management | `db:push` (local), `db:generate` + `db:migrate` (prod) | S-0001 | Migrations introduced as schema evolves |
| Service catalog | Two-level: categories → items | S-0003 | Soft delete via `active` flag; prices in integer cents |
| Nav order | Dashboard, Today, Services, Requests, Clients, Quotes, then remaining items | S-0009 | Quotes enabled in S-0009; Jobs enabled in S-0012; Schedule enabled in S-0013; Today enabled in S-0015; Invoices still disabled |
| Client/Property model | Two-level: clients → properties | S-0004 | Soft delete with cascade; nullable email (phone-only clients OK) |
| Pagination | Cursor-based keyset pagination | S-0004 | `PaginatedResult<T>` with `(created_at DESC, id DESC)`, fetch limit+1 |
| Server-side search | ILIKE across multiple columns | S-0004 | `?search=term` on `GET /v1/clients` |
| UI theme | USWDS-inspired dark navy reskin | Post-S-0004 | Deep navy primary (`#1e3a5f`), dark sidebar (`#0f172a`), tight radii (2/4/6/8px), `ring-2` focus indicators |
| Branding | "Seedling HQ" with 🌱 emoji | Post-S-0004 | Displayed in sidebar, topbar, and mobile drawer |
| Client detail tabs | Info / Properties / Activity | S-0005 | Tab layout with ARIA roles; Activity tab shows audit event timeline |
| Timeline data source | audit_events table query | S-0005 | No new table; composite index `(tenant_id, subject_type, subject_id, created_at)` |
| Public request form | Public endpoint + honeypot + rate limit | S-0006 | `/v1/public/requests/:tenantSlug`, in-memory sliding window rate limiter |
| Request status machine | `new` → `reviewed` → `converted` / `declined` | S-0006 | Initial status always `new`; source: `public_form` or `manual` |
| Spam protection | Honeypot + per-IP rate limit | S-0006 | Honeypot: silent fake success; rate limit: 5 req/min per IP (in-memory, prod uses API Gateway) |
| Email notifications | Nodemailer → Mailpit (local SMTP) | S-0007 | `NOTIFICATION_ENABLED` config toggle; best-effort (never throws) |
| Message outbox | Durable log for email + SMS | S-0007 | `message_outbox` table; email sent immediately, SMS queued for S-0021 worker |
| Email template | Plain HTML string builder | S-0007 | `buildRequestNotificationEmail()` with XSS-safe `escapeHtml()`; no template engine |
| Owner lookup | `getOwnerByTenantId` on UserRepository | S-0007 | Query users WHERE role='owner' for notification recipient |
| Quote entity | Draft quote with JSONB lineItems | S-0008 | `quotes` table with nullable `requestId`/`propertyId` FKs; status machine: draft→sent→approved/declined/expired |
| Convert status gate | Only `new` or `reviewed` requests | S-0008 | Prevents double conversion; returns 400 for `converted`/`declined` |
| Convert redirect | Quote detail page | S-0009 | Changed from `/clients/:id` to `/quotes/:id` after conversion (S-0008 deferred item resolved) |
| Name splitting | Split on last space | S-0008 | "Sarah Jane Davis" → "Sarah Jane" / "Davis"; single word → all firstName |
| Quote search | ILIKE on `title` only | S-0009 | Title typically contains client name; avoids JOIN complexity |
| Quote line item editing | Inline editable rows | S-0009 | No modal; description, qty, unit price inputs with computed totals |
| Quote tax | Manual fixed-cents entry | S-0009 | No automatic tax rate for MVP; simple dollar input |
| Quote edit guard | Only `draft` quotes editable | S-0009 | PUT returns 400 ValidationError for non-draft; status transitions deferred to S-0010 |
| Secure link token hashing | HMAC-SHA256 with `SECURE_LINK_HMAC_SECRET` | S-0010 | `hashToken()` in `shared/crypto.ts`; tokens stored as hash, never plaintext |
| Secure link token format | `crypto.randomUUID()` raw, hashed before storage | S-0010 | 122-bit entropy; raw token returned once to owner, hash stored in DB |
| Secure link default TTL | 14 days | S-0010 | Configurable 1–90 days via `expiresInDays` param; security doc recommends 7–14 |
| External route prefix | `/v1/ext/quotes/:token` | S-0010 | Distinct from `/v1/public/` (no auth) and `/v1/` (internal auth); token-derived auth |
| External auth context | Separate `externalAuthContext` Fastify decorator | S-0010 | Avoids breaking existing `authContext` type; set by `buildExternalTokenMiddleware` |
| Secure link config vars | `APP_BASE_URL`, `SECURE_LINK_HMAC_SECRET` | S-0010 | Base URL for link construction; HMAC secret for token hashing; production guard: `loadConfig()` throws if secret is missing, equals dev default, or < 16 chars |
| Token scopes include respond | `['quote:read', 'quote:respond']` on send | S-0011 | Same link for view + approve/decline; no new token needed |
| Idempotent external actions | Same-action repeat → 200 no-op, cross-transition → 400 | S-0011 | Client may double-click approve; prevent approve→decline flip |
| External principal type | `principalType: 'external'`, `principalId: tokenId` | S-0011 | Distinguishes token-based actions from `internal` (user) and `system` (automation) |
| Quote response status machine | `sent` → `approved` / `declined` | S-0011 | Only `sent` quotes can be responded to; draft/expired/already-terminal blocked |
| Standalone quote creation | `POST /v1/quotes` | S-0026 | Standalone quotes without a request; validates client (exists, active) and property (exists, active, belongs to client); `requestId: null` |
| Local login endpoint | `POST /v1/auth/local/login` | S-0027 | Cross-tenant email lookup; returns accounts array; 404 when `AUTH_MODE !== 'local'`; rate limited 10 req/min |
| AuthGuard | React component wrapping `<AppShell>` | S-0027/S-0030 | Uses `useAuth()` context (isLoading/isAuthenticated); redirects to `/login` if not authenticated |
| Catch-all redirect | `/login` (was `/dashboard`) | S-0027 | Unknown routes redirect to login instead of dashboard |
| CDK workspace | Standalone `infra/cdk/` with own `package.json` | S-0028 | NOT in `pnpm-workspace.yaml`; CDK has different deps/toolchain; `pnpm install --ignore-workspace` |
| Cognito User Pool | UUID username, email required (not unique/alias), `custom:tenant_id` immutable | S-0028 | Same-email-across-tenants; login via custom React page + lookup endpoint, not Cognito's email login |
| Cognito App Client | PKCE (no secret), access 1h, ID 1h, refresh 30d | S-0028 | Self-signup disabled; groups: owner, admin, member |
| CDK resource naming | `fsa-<env>-<owner>-<resource>` | S-0028 | Tags: `app=fsa`, `env`, `owner` on all resources |
| JWT library | `jose` (ESM-native, zero-dep) | S-0029 | `createRemoteJWKSet` for JWKS caching + key rotation; `createLocalJWKSet` for tests |
| JWT token type | Access token (not ID token) | S-0029 | Security best practice; `custom:tenant_id` copied into access token via pre-token-generation Lambda |
| JWT verifier port | `JwtVerifier` in `application/ports/` | S-0029 | `verify(token) → { tenantId, userId, role }`; `CognitoJwtVerifier` implementation in `infra/auth/` |
| JWT user ID claim | `username` (not `sub`) | S-0029 | Contract: Cognito `username` must equal `users.id` (enforced at user provisioning time, not S-0029) |
| JWT role extraction | `cognito:groups` — exactly one group | S-0029 | Rejects 0 or >1 groups; validates against `ROLES` from `roles.ts` |
| Cognito group rename | `member` (not `technician`) | S-0029 | Product-neutral role name; CDK updated |
| AUTH_MODE validation | Runtime validation in `loadConfig()` | S-0029 | Rejects invalid values like `'cogntio'`; Cognito env vars required only when `AUTH_MODE=cognito` |
| CDK pre-token-generation trigger | V2_0 Lambda + `FeaturePlan.ESSENTIALS` | S-0029 | Lambda copies `custom:tenant_id` into access token; `Code.fromInline()` (no build step) |
| Frontend Cognito SDK | `amazon-cognito-identity-js` + `buffer` polyfill | S-0030 | ~18KB gzipped; `USER_PASSWORD_AUTH` flow; `global: 'globalThis'` in vite.config.ts for SDK browser compat |
| Frontend auth state | `AuthProvider` React context + `useAuth()` hook | S-0030 | Dual-mode: local (localStorage) or cognito (sessionStorage via SDK); wraps app inside `QueryClientProvider`, outside `BrowserRouter` |
| Frontend token storage | sessionStorage via custom `ICognitoStorage` | S-0030 | Survives page refresh, cleared on tab close; `SessionCognitoStorage` in `lib/auth/cognito-storage.ts` |
| Frontend auth mode | `VITE_AUTH_MODE` env var (build-time) | S-0030 | Defaults to `'local'` when unset; Vite reads from root `.env` via `envDir: '../../'` |
| Cognito email-to-username lookup | `POST /v1/auth/cognito/lookup` | S-0030 | Public, rate-limited 10 req/min; returns `cognitoUsername` (= `users.id`); 404 when `AUTH_MODE !== 'cognito'` |
| Tenant creation gate | `POST /v1/tenants` returns 404 in cognito mode | S-0030 | Self-signup disabled in Cognito; backend prevents direct API calls |
| Token refresh on-demand | `getToken()` checks expiry, refreshes if <5min remaining | S-0030 | Simpler than background timer; `forceRefresh()` for 401 retry |
| 401 retry with auth failure | Single retry via `forceRefresh()` with 3 failure paths | S-0030 | (1) `forceRefresh()` rejects → `onAuthFailure()` → logout; (2) retry returns 401 → `onAuthFailure()` → logout; (3) retry fetch throws network error → propagate error, NO logout (transient failure) |
| NEW_PASSWORD_REQUIRED | Inline form in LoginPage step machine | S-0030 | `authenticate()` returns `{ newPasswordRequired }` for synchronous step detection |
| Local password hashing | `node:crypto` scrypt in `shared/password.ts` | S-0030 | Zero deps; self-describing format `scrypt:N:r:p:salt:hash`; timing-safe compare |
| Local password verify endpoint | `POST /v1/auth/local/verify` | S-0030 | Accepts `{ userId, password }`; rate limited 10/min; 404 in cognito mode; returns user info |
| Password column | Nullable `password_hash` varchar(255) on users | S-0030 | Cognito-mode users don't store passwords locally; 401 if hash missing |
| Signup password | `ownerPassword` required on `POST /v1/tenants` | S-0030 | Min 8 chars, max 128; required in Zod schema + DTO; hashed before storage; seed demo user with `password` |
| Demo credentials | `owner@demo.local` / `password` | S-0030 | Hint text updated on login page |
| CognitoProvisioner port | Explicit interface with `provisionUser` + `setUserPassword` | S-0031 | `AwsCognitoProvisioner` for prod, `NoopCognitoProvisioner` for local; testable via mock |
| User provisioning re-use | Re-use disabled user's UUID on retry | S-0031 | Preserves `username=users.id` Cognito contract; avoids UUID drift |
| ForbiddenError (403) | New `AppError` subclass, code `FORBIDDEN` | S-0031 | Role guard needs distinct error from 401 `UNAUTHORIZED` |
| Role hierarchy | Owner > Admin > Member, inline guards | S-0031 | Owner can manage all; admin can manage members; full RBAC deferred to S-0036 |
| DB CHECK constraints | `users.role` and `users.status` CHECK constraints | S-0031 | Enforces enum values at DB layer in addition to TS + Zod validation |
| Team management routes | `GET /v1/users`, `POST /v1/users`, `POST /v1/users/:id/reset-password` | S-0031 | Owner/admin only; mode-specific Zod schemas (local requires password) |
| Change own password | `POST /v1/users/me/password` (local mode only) | S-0031 | Any authenticated role; requires current password; scrypt hashing |
| Local auth localStorage | Persist role/name/tenantName alongside tenant_id/user_id | S-0031 | Fixes role-gated UI after page refresh in local mode |
| Job/Visit entities | Job (1:1 to Quote via unique constraint) + Visit (1:* to Job) | S-0012 | Created atomically from approved quote inside UoW |
| Quote `scheduled` status | `approved → scheduled` transition with `scheduledAt` timestamp | S-0012 | Tracks when job was created; cross-cutting: RespondToQuoteUseCase treats as idempotent approve, PublicQuoteViewPage treats as approved |
| Job creation idempotency | Pre-check (status=scheduled → lookup) + scoped unique violation catch | S-0012 | Two-layer idempotency: status-based fast path + DB constraint fallback |
| Visit duration aggregation | Sum `estimatedDurationMinutes` from quote line items' service items; default 60 | S-0012 | Decoupled from service item changes after creation |
| Job-to-Quote lookup | `GET /v1/jobs/by-quote/:quoteId` | S-0012 | Enables deterministic navigation from scheduled quote to its job |
| Job detail visits | Embedded visits array in `GET /v1/jobs/:id` response | S-0012 | Few visits per job; avoids extra round-trip |
| Visit scheduling | `ScheduleVisitUseCase` — no UoW, direct repo + best-effort audit | S-0013 | Single entity write; `updateSchedule` WHERE status='scheduled' for race safety |
| Visit routes | Flat `/v1/visits/*` for calendar operations | S-0013 | 3 endpoints: GET range, GET unscheduled, PATCH schedule; separate from embedded visits in job response |
| Audit metadata | JSONB `metadata` column on `audit_events` | S-0013 | `visit.time_set` + `visit.rescheduled` with timestamp metadata; nullable, existing events have null |
| Calendar UI | Hand-built CSS Grid week view | S-0013 | No calendar library; 7-day columns, time gutter, PX_PER_HOUR positioning |
| Calendar date range | Max 8-day window on `GET /v1/visits` | S-0013 | Prevents unbounded queries; week view is 7 days |
| Week navigation | URL query param `?week=YYYY-MM-DD` | S-0013 | Deep-linkable; defaults to current week's Monday |
| Schedule modal | Card-based overlay (ResetPasswordDialog pattern) | S-0013 | `<input type="datetime-local">`, auto-computed end from duration |
| Visit assignment | `PATCH /v1/visits/:id/assign` separate from `/schedule` | S-0014 | Assign and schedule are orthogonal; `assignedUserId: null` to unassign |
| Assignment RBAC | Owner + Admin can assign; Member cannot | S-0014 | Inline ForbiddenError guard; no status guard on assign |
| VisitWithContext assignee | LEFT JOIN users for `assignedUserName` | S-0014 | Displayed on calendar blocks and unscheduled cards |
| My Visits filter | `?assignedUserId=` on GET visit endpoints + `?mine=true` UI toggle | S-0014 | Filters both scheduled (calendar) and unscheduled panels |
| Tech picker in modal | `<select>` dropdown in ScheduleVisitModal | S-0014 | Role-gated to owner/admin; dual mutation (schedule + assign) with partial success handling |
| Visit status transition | `PATCH /v1/visits/:id/status` with `{ status }` body | S-0015 | Single endpoint for all transitions; `scheduled` excluded from body enum (cannot set back to scheduled) |
| Visit status machine | `scheduled → [en_route, started, cancelled]`, `en_route → [started, cancelled]`, `started → [completed, cancelled]` | S-0015 | `scheduled → completed` NOT allowed (must pass through `started`); `en_route` optional; terminal: `completed`, `cancelled` |
| Visit transition RBAC | Cancel = owner/admin only; forward = owner/admin any, member own assigned only | S-0015 | Members can only transition their own assigned visits; members cannot cancel |
| Job auto-derivation | Inside TransitionVisitStatusUseCase after visit update, best-effort | S-0015 | `started` + job scheduled → in_progress; all terminal: all cancelled → cancelled, >=1 completed → completed |
| VisitWithContext client contact | LEFT JOIN clients for `clientPhone` and `clientEmail` | S-0015 | Avoids N+1 for tel:/mailto: links on Today cards |
| Today page | `/today` inside AppShell, CalendarCheck icon between Dashboard and Services | S-0015 | Mobile-first; shows visits assigned to current user for today; all roles see it |
| Visit updateStatus race guard | `updateStatus(tenantId, id, status, expectedStatuses[])` | S-0015 | WHERE `status IN (expectedStatuses)` prevents concurrent transitions; returns null if 0 rows |
| Visit notes editing | Separate `PATCH /v1/visits/:id/notes` endpoint | S-0016 | Status guard: en_route/started/completed only; RBAC: owner/admin any, member own assigned |
| Photo storage | S3 via presigned POST, LocalStack for local dev | S-0016 | `@aws-sdk/s3-presigned-post` with `content-length-range`; `FileStorage` port + `S3FileStorage` impl |
| Photo entity lifecycle | `pending` → `ready` via atomic confirm | S-0016 | `visit_photos` table; `SELECT ... FOR UPDATE` serializes concurrent confirms; max 20 ready per visit |
| Completion UX | Confirmation alert before completing | S-0016 | "Any notes or photos to add?" prompt with "Complete Anyway" / "Go Back" |
| CDK + LocalStack parity | Same CDK stack deploys to both AWS and LocalStack | DevEx | `scripts/localstack-deploy.sh` uses native `cdk deploy` + `AWS_ENDPOINT_URL` override (not `cdklocal` — broken with CDK >= 2.177); `skipCognito=true` context flag skips Cognito for LocalStack; `.env.localstack` auto-generated with resource names/URLs |
| S3_BUCKET always required | No hardcoded default; set via `.env.localstack` in dev | DevEx | Eliminates drift between CDK-deployed bucket name and config default; `.env.localstack` is loaded as second `--env-file` by API dev script |
