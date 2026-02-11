# CLAUDE.md — Seedling-HQ AI Context Index

> **Entry point for AI-driven development.** Read these context packs before making design or implementation decisions.
>
> Definition of Done for every story:
> - AWS-first + local-first dev
> - spec-driven (OpenAPI → generated TS client)
> - multi-tenant safety
> - external secure-link safety
> - responsive + accessible UI
> - tests required for pitfalls (tenancy, secure links, async/idempotency)

---

## Context packs (in `docs/context/`)

| # | Topic | File | Key contents |
|---|-------|------|-------------|
| 1 | Architecture + dev sandbox | `seedling-hq_mvp-context_architecture_dev-sandbox_UPDATED.md` | System architecture, naming conventions, local dev contract, CDK sandbox, env vars, MVP flows |
| 2 | UI/UX (Tailwind + shadcn/ui) | `seedling-hq_ui-ux-context_tailwind-shadcn_ai-dev.md` | Responsive strategy, USWDS-inspired UX, component inventory, screen patterns, a11y audits |
| 3 | Testing (Vitest + Playwright) | `seedling-hq_testing-context_vitest_playwright_ai-dev_TDD.md` | Test pyramid, TDD workflow, tenancy/secure-link/async invariants, Playwright + axe |
| 4 | Security baseline | `seedling-hq_security-baseline_context_ai-dev.md` | Principals, secure-link token policy, PII/logging redaction, IAM, audit cadence |
| 5 | Observability + telemetry | `seedling-hq_observability-telemetry-spec_context_ai-dev.md` | Correlation IDs, structured logging, metrics, audit events, dashboards/alerts |
| 6 | Documentation gaps | `seedling-hq_context-gaps_next-docs_team-share.md` | Missing docs tracker (3 of 9 remaining: CI/CD, automation, comms/payments) |
| 7 | DevEx + Clean Architecture | `seedling-hq_devex-repo-conventions_clean-architecture_ai-dev_TDD.md` | Layer boundaries, feature-building rails, TDD expectations |
| 8 | Data access + tenancy | `seedling-hq_data-access_tenancy-enforcement_clean-architecture_ai-dev.md` | Tenant-safe repos, indexes, secure-link storage, outbox, S3 keying |
| 9 | Domain model + status machines | `seedling-hq_domain-model_status-machines_audit-catalog.md` | Entity definitions, status machines, audit event catalog, relationships |
| 10 | API standards | `seedling-hq_api-standards_errors_pagination_idempotency.md` | Error shape/codes, response conventions, pagination, idempotency, naming |

### Which docs to read for common tasks

| Task | Read these docs |
|------|----------------|
| Adding/altering an API endpoint | Architecture (#1), API Standards (#10), Domain Model (#9), Security (#4), Observability (#5), Testing (#3) |
| Adding/altering UI | UI/UX (#2), Testing (#3), Observability (#5) |
| Adding async jobs, reminders, or comms | Architecture (#1), Security (#4), Observability (#5), Testing (#3) |
| Adding a new entity or status machine | Domain Model (#9), Data Access (#8), API Standards (#10), Testing (#3) |
| Adding external/secure-link endpoints | Security (#4), Data Access (#8), API Standards (#10), Architecture (#1), Testing (#3) |

---

## Non-negotiable MVP reminders

- **Tenant = internal customer (business).** External customers are tenant-owned records.
- External access is via **tenant-bound, object-bound, scope-bound secure links** (token hashed + expiry + revocation).
- **Outbound SMS + automation/reminders are MVP requirements.**
- Every story must work in **local dev** and include **tests** and **a11y/responsive checks**.
- Default workflow is **TDD-first** for domain + use cases (see DevEx doc #7).

---

## Key design decisions (resolved)

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
| Nav order | Dashboard, Services, Requests, Clients, Quotes, then remaining items | S-0009 | Quotes enabled in S-0009; Schedule, Jobs, Invoices still disabled |
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
| 401 retry with auth failure | Single retry via `forceRefresh()` → on 2nd 401: `onAuthFailure()` → logout | S-0030 | `onAuthFailure` also called if `forceRefresh()` rejects |
| NEW_PASSWORD_REQUIRED | Inline form in LoginPage step machine | S-0030 | `authenticate()` returns `{ newPasswordRequired }` for synchronous step detection |

---

## Established patterns

### Backend

| Pattern | Story | Description |
|---------|-------|-------------|
| UnitOfWork for atomic writes | S-0001 | `UnitOfWork` port + `DrizzleUnitOfWork`; use cases take `(readRepo, uow)` |
| Defensive unique-constraint catch | S-0001 | Wrap `uow.run()` in try/catch; map SQL state `23505` → `ConflictError` via `isUniqueViolation()` |
| Singleton upsert | S-0002 | `onConflictDoUpdate` on unique `tenant_id` constraint; no UoW needed |
| Audit event derivation | S-0002 | Compare `createdAt` vs `updatedAt` timestamps to determine created/updated event |
| GET returns null on empty | S-0002 | Return `null` with 200 for "not yet configured" singletons, not 404 |
| Read-only routes skip use cases | S-0003 | List/getById call repo directly in route handlers |
| Soft delete via active flag | S-0003 | Set `active = false`, return 204; parent deactivation cascades to children |
| Price in integer cents | S-0003 | Store cents in DB, dollars in UI; `dollarsToCents()` / `centsToDollars()` |
| DELETE returns 204 | S-0003 | Frontend `request()` handles 204 by returning `undefined` |
| Cursor-based pagination | S-0004 | `encodeCursor`/`decodeCursor` (base64url JSON); fetch limit+1 to detect `hasMore` |
| Server-side search (ILIKE) | S-0004 | `OR(ILIKE(col, %term%))` across name/email/phone/company columns |
| Count endpoint | S-0004 | `GET /v1/clients/count` for dashboard metrics |
| Nested + flat URLs | S-0004 | Properties listed at `/v1/clients/:clientId/properties`, operated at `/v1/properties/:id` |
| Post-trim validation on updates | S-0004 | Update use cases must validate required fields after trimming; create and update paths should have matching validation |
| Timeline via audit_events query | S-0005 | `listBySubjects(tenantId, subjectIds[], filters)` — no new table, reuse audit_events with composite index; always pass `subjectTypes` filter to match the `(tenant_id, subject_type, subject_id, created_at)` index |
| Event label mapping | S-0005 | `getEventLabel()` maps `client.created` → "Client created" etc.; titlecase fallback for unknown events |
| Timeline exclude filter | S-0005 | `?exclude=deactivated` filters out `*.deactivated` event names server-side |
| Public endpoint (no auth) | S-0006 | `/v1/public/*` routes skip auth middleware; use `publicRequest()` on frontend (no dev auth headers) |
| Honeypot spam protection | S-0006 | Hidden `website` field; if filled, return fake 201 with random UUID, don't persist |
| In-memory rate limiter | S-0006 | Sliding window `Map<ip, {count, windowStart}>`, configurable window/max, periodic cleanup; `resetRateLimitStore()` for tests; `trustProxy: true` in Fastify for correct client IP behind ALB/API Gateway |
| Tenant resolution via slug | S-0006 | Public routes use `:tenantSlug` param → `tenantRepo.getBySlug()` to resolve tenant |
| System audit principal | S-0006 | Public/automated actions use `principalType: 'system'`, `principalId: 'public_form'` |
| Count by status endpoint | S-0006 | `GET /v1/requests/count?status=new` for dashboard metrics with status filter |
| Message outbox pattern | S-0007 | `MessageOutboxRepository.create()` → SMTP send → `updateStatus(sent/failed)`; outbox IS the durable record |
| Best-effort notification | S-0007 | `SendRequestNotificationUseCase` wraps all logic in try/catch — never throws; route handler awaits but failures are silent |
| Notification wiring in routes | S-0007 | Route handler calls notification use case after `CreatePublicRequestUseCase`; keeps create use case unchanged |
| SMS outbox as queued | S-0007 | SMS outbox records created with `status: 'queued'`; actual sending deferred to S-0021 worker |
| Atomic cross-entity conversion | S-0008 | `ConvertRequestUseCase` writes client + property + quote + request status update + 3-4 audit events inside single `uow.run()` |
| Extended TransactionRepos | S-0008 | UoW provides `clientRepo`, `propertyRepo`, `requestRepo`, `quoteRepo` alongside original `tenantRepo`, `userRepo`, `auditRepo` |
| Request `updateStatus` with race guard | S-0008 | `RequestRepository.updateStatus(tenantId, id, status, expectedStatuses?)` adds `WHERE status IN (...)` to prevent concurrent double-convert; returns `null` (0 rows) if another transaction already transitioned the status → throw `ConflictError` to roll back |
| Composite convert endpoint | S-0008 | `POST /v1/requests/:id/convert` returns 200 (not 201) with `{ request, client, property, quote, clientCreated }` |
| Existing client match on convert | S-0008 | Optional `existingClientId` skips client creation; frontend searches by email with debounced query |
| Quote list with status filter | S-0009 | `GET /v1/quotes?status=draft&search=term` with cursor pagination; `QuoteRepository.list()` follows `DrizzleRequestRepository.list()` pattern |
| UpdateQuoteUseCase (no UoW) | S-0009 | Direct repo + best-effort audit (follows `UpdateClientUseCase` pattern); draft guard, line item validation, total recomputation |
| Quote routes (4 endpoints) | S-0009 | `GET /v1/quotes`, `GET /v1/quotes/count`, `GET /v1/quotes/:id`, `PUT /v1/quotes/:id`; count registered before `:id` to avoid route conflict |
| External token middleware | S-0010 | `buildExternalTokenMiddleware({ secureLinkTokenRepo, config, requiredScope, requiredSubjectType? })` — hashes incoming `:token` param, validates expiry/revocation/scope/subjectType, sets `request.externalAuthContext`; returns 403 `LINK_INVALID` on failure; missing referenced object also returns 403 (not 404) to avoid leaking existence |
| hashToken utility | S-0010 | `hashToken(secret, rawToken)` in `shared/crypto.ts` — HMAC-SHA256, returns 64-char hex; used in both middleware and SendQuoteUseCase |
| SendQuoteUseCase (atomic + best-effort) | S-0010 | Inside `uow.run()`: updateStatus(draft→sent) + create token + audit; after UoW (best-effort): get client email, create outbox, send email |
| Quote send route + external view | S-0010 | `POST /v1/quotes/:id/send` (authenticated, returns `{ quote, token, link }`), `GET /v1/ext/quotes/:token` (external, token-derived auth, returns quote + businessName + clientName + propertyAddress) |
| Quote `updateStatus` with race guard | S-0010 | `QuoteRepository.updateStatus(tenantId, id, status, statusFields?, expectedStatuses?)` — `WHERE status IN (...)` prevents concurrent transitions; returns null if 0 rows (caller handles: SendQuoteUseCase throws ConflictError, RespondToQuoteUseCase re-fetches for idempotency) |
| RespondToQuoteUseCase (single class) | S-0011 | Parameterized by `action: 'approve' | 'decline'`; no UoW needed (single entity write + best-effort audit + notification); race-safe idempotency: on null updateStatus, re-fetches quote — same-action race → 200 with current state, cross-action race → 400 ValidationError |
| External approve/decline routes | S-0011 | `POST /v1/ext/quotes/:token/approve` and `/decline`; `respondMiddleware` requires `quote:respond` scope; returns `{ quote: { id, status, approvedAt, declinedAt } }` |
| Quote response notification | S-0011 | Best-effort email to owner via outbox; `buildQuoteResponseEmail()` inline HTML builder; type `quote_approved`/`quote_declined` in outbox |
| CreateStandaloneQuoteUseCase (no UoW) | S-0026 | Direct repo + best-effort audit; validates client (exists, active), property (optional: exists, active, belongs to client); creates draft with empty line items |
| POST /v1/quotes route | S-0026 | Body: `{ clientId, propertyId?, title }`; returns 201; `propertyRepo` added to `buildQuoteRoutes` deps |
| AUTH_MODE route guard | S-0027 | Return 404 when `config.AUTH_MODE !== 'local'` to hide dev-only endpoints in cognito mode |
| Cross-tenant user lookup | S-0027 | `listActiveByEmail(email)` joins users+tenants, case-insensitive via `lower()` (not `ilike` — avoids `_`/`%` wildcard leaks), filters both active; used by login endpoint |
| Auth routes (separate file) | S-0027 | `buildAuthRoutes({ userRepo, config })` in `auth-routes.ts`; public (no auth middleware), rate-limited |
| Zod trim+lowercase before email | S-0027 | `z.string().trim().toLowerCase().email()` ensures normalization happens before validation |
| CDK standalone workspace | S-0028 | `infra/cdk/` with own `package.json`; install with `pnpm install --ignore-workspace`; deploy with `pnpm dlx aws-cdk@2 deploy --context env=dev --context owner=<name>` |
| CDK resource naming + tags | S-0028 | Prefix `fsa-${env}-${owner}` on all resources; tags: `app=fsa`, `env`, `owner`; `RemovalPolicy.DESTROY` for dev sandbox |
| DevSandboxStack construct | S-0028 | `lib/dev-sandbox-stack.ts` takes `env_name`, `owner`, `allowedOrigin`; provisions User Pool + Groups + App Client; outputs UserPoolId, UserPoolArn, AppClientId, JwksUrl, AllowedCorsOrigin |
| JwtVerifier port + CognitoJwtVerifier | S-0029 | Port: `application/ports/jwt-verifier.ts`; impl: `infra/auth/cognito-jwt-verifier.ts`; uses `jose.jwtVerify()` + `createRemoteJWKSet`; validates issuer, `client_id` (not `aud`), `token_use=access`, `custom:tenant_id` (UUID format), `username` (UUID format), exactly-one `cognito:groups` |
| Bearer token extraction in middleware | S-0029 | `buildAuthMiddleware({ config, jwtVerifier? })` — cognito path extracts `Bearer <token>` from `Authorization` header, calls `jwtVerifier.verify()`, sets `authContext` |
| Cognito config conditional validation | S-0029 | `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_REGION` required via `required()` when `AUTH_MODE=cognito`, default to `''` via `optional()` when `local` |
| Fail-fast verifier creation | S-0029 | `createApp()` creates `CognitoJwtVerifier` at startup when `AUTH_MODE=cognito`; throws immediately if config is invalid |
| CDK pre-token-generation Lambda | S-0029 | `Code.fromInline()` JS function copies `custom:tenant_id` into access token; wired via `userPool.addTrigger(PRE_TOKEN_GENERATION_CONFIG, fn, LambdaVersion.V2_0)` |
| Cognito lookup route | S-0030 | `POST /v1/auth/cognito/lookup` — public, rate-limited, returns `cognitoUsername` (= `users.id`); reuses `listActiveByEmail()` and `loginBodySchema`; 404 when `AUTH_MODE !== 'cognito'` |
| Tenant creation gate | S-0030 | `POST /v1/tenants` returns 404 in cognito mode — early return before use case execution; 404 response schema added |

### Frontend

| Pattern | Story | Description |
|---------|-------|-------------|
| Wizard as `<div>` not `<form>` | S-0002 | Native inputs trigger implicit submit in `<form>`; use explicit `onClick` |
| Local auth override via headers | S-0002 | `X-Dev-Tenant-Id` / `X-Dev-User-Id` in localStorage, sent on all requests |
| Scroll container is `<main>` | S-0002 | `document.querySelector('main')?.scrollTo()`, not `window.scrollTo()` |
| Loading skeletons | S-0002 | `Skeleton` component for async data loading states |
| Dollar/cents conversion | S-0003 | Convert before API calls and after responses |
| E2E scoped locators | S-0003 | Use `.filter({ hasText: ... })` when seed/test data coexist |
| `useInfiniteQuery` for pagination | S-0004 | React Query hook for "Load More" cursor-based pagination |
| Debounced search input | S-0004 | 300ms `setTimeout` in `useEffect` for search-as-you-type |
| Tab layout on detail pages | S-0005 | `useState<Tab>` + tab bar with `role="tablist"` + `role="tab"` + `role="tabpanel"` |
| Timeline component | S-0005 | `TimelineSection` with `useInfiniteQuery`, event icons, relative timestamps, "Hide removals" toggle |
| Public page (no AppShell) | S-0006 | Public pages like `/request/:tenantSlug` render outside `<AppShell>` (like SignupPage) |
| `publicRequest()` API function | S-0006 | Separate fetch wrapper that skips dev auth headers for public endpoints |
| Status badge component | S-0006 | Inline `StatusBadge` with color map for request statuses (new=amber, reviewed=blue, etc.) |
| Request detail + convert flow | S-0008 | `RequestDetailPage` shows request info + "Convert to Client" button; `ConvertRequestPage` pre-fills from request, supports existing client match, creates client+property+quote |
| Name splitting on convert | S-0008 | `splitName()` splits on last space for pre-fill; user can edit in form |
| QuotesPage with status filter pills | S-0009 | Row of pill buttons (All/Draft/Sent/Approved/Declined) controlling `statusFilter` state; `useInfiniteQuery` with status+search params |
| QuoteDetailPage inline builder | S-0009 | `LineItemRow` components with description/qty/price inputs; `ServiceItemPicker` dropdown grouped by category; auto-computed subtotal/total; editable tax input |
| Convert redirect to quote | S-0009 | `ConvertRequestPage` redirects to `/quotes/:id` on success (changed from `/clients/:id`) |
| Send quote confirmation flow | S-0010 | "Send Quote" button → inline confirmation card → success shows copyable link card; quote becomes read-only after send |
| Public quote view page | S-0010 | `/quote/:token` outside AppShell; uses `publicRequest()` to `GET /v1/ext/quotes/:token`; shows business name, client name, line items table, totals; 403 → "link no longer valid" |
| Copy-to-clipboard link | S-0010 | `navigator.clipboard.writeText()` with visual "Copied" feedback via useState toggle |
| Public quote approve/decline flow | S-0011 | Approve button → direct call; Decline button → confirmation dialog (state-based, matches send confirm pattern); success → status banner + hide buttons; `useEffect` resets respond state on token change |
| Already-responded read-only banners | S-0011 | If `status === 'approved'/'declined'` on page load, show date-stamped banner, hide action buttons |
| Quote detail timestamps | S-0011 | Below status badge: green "Approved on {date}" or red "Declined on {date}" from `quote.approvedAt`/`declinedAt` |
| CreateQuotePage with client search | S-0026 | Debounced search → radio select → property dropdown → auto-title → redirect to `/quotes/:id`; route `/quotes/new` before `/:id` |
| New Quote button on QuotesPage | S-0026 | `data-testid="new-quote-btn"` in header; updated empty state text |
| AuthGuard wrapping AppShell | S-0027 | `<AuthGuard><AppShell /></AuthGuard>` in Route element; checks localStorage, redirects to `/login` |
| Login page two-step flow | S-0027 | Step 1: email input → `localLogin(email)` via `publicRequest()`; Step 2: account picker (if multiple); auto-select if single account |
| Logout in Sidebar + MobileDrawer | S-0027 | Clear `dev_tenant_id`/`dev_user_id` from localStorage, `navigate('/login')`; drawer also calls `onOpenChange(false)` |
| Login/Signup cross-links | S-0027 | LoginPage → "Don't have an account? Sign up"; SignupPage → "Already have an account? Log in" |
| AuthProvider wraps BrowserRouter | S-0030 | `<QueryClientProvider><AuthProvider><BrowserRouter>` — AuthProvider needs QueryClient for cache clear on logout; outside BrowserRouter intentionally |
| AuthGuard uses useAuth() | S-0030 | `isLoading` → render null; `!isAuthenticated` → `<Navigate to="/login">`; replaces direct localStorage check |
| Dual-mode LoginPage | S-0030 | Step machine: email → accounts → password (cognito) → new-password (challenge); local auto-selects single account |
| Signup disabled in cognito mode | S-0030 | `isCognitoMode()` → "Contact admin" card with link to login; local mode unchanged |
| Sidebar/Drawer useAuth().logout() | S-0030 | Replaces manual `localStorage.removeItem` + `queryClient.clear()` + `navigate('/login')` |
| api-client setAuthProvider | S-0030 | Module-level `authProvider` enables Bearer token injection + 401 retry; `clearAuthProvider()` on logout/auth failure |
| cognitoLookup DTO normalization | S-0030 | `apiClient.cognitoLookup()` maps `cognitoUsername` → `userId` so LoginPage uses unified `LoginAccount` type |
| Buffer polyfill for Cognito SDK | S-0030 | `buffer` npm package + `define: { global: 'globalThis' }` in vite.config.ts — SDK uses Node's `Buffer` |

### Testing

| Pattern | Story | Description |
|---------|-------|-------------|
| E2E DB isolation | S-0002 | `db:reset` → `db:push` → `db:seed` in globalSetup |
| Cross-project skip | S-0002 | `test.skip(testInfo.project.name !== 'desktop-chrome', 'reason')` inside test body |
| Integration DB sharing | S-0001 | `pool: 'forks'` + `singleFork: true` in vitest config |
| `setDemoAuth` E2E helper | S-0027 | `e2e/helpers/auth.ts` — `page.addInitScript()` sets demo localStorage before every page load; add to `test.beforeEach` in all authenticated E2E tests |
| Logout E2E uses `page.evaluate` | S-0027 | Don't use `addInitScript` when testing logout — it re-sets localStorage on navigation; use `page.evaluate(() => localStorage.setItem(...))` instead |

---

## Deferred to later stories

| Item | Deferred to | Reason |
|------|-------------|--------|
| Cognito user provisioning (`username = users.id`) | Post-S-0029 | S-0029 documents the contract; provisioning story must enforce `AdminCreateUser` sets `username` to `users.id` |
| ~~Frontend Cognito SDK~~ | ~~S-0030~~ | ~~Completed in S-0030~~ |
| DB CHECK constraint or enum for `role` column | Post-S-0029 | Role safety from TS `Role` type + Zod + Cognito groups; DB constraint deferred |
| SMS worker (send from outbox) | S-0021 | `message_outbox` table exists; SMS records queued but not sent |
| LocalStack in docker-compose | S-0007+ | Not needed until async/queue stories |
| EventBridge bus + Scheduler | S-0022+ | Not needed until automation stories |
| Stripe integration | S-0018 | |
| CI/CD pipeline | Post-MVP | Context gap #6 |
| Testcontainers | When CI needs self-contained DB | Reuse docker-compose Postgres for now |

---

## Story implementation workflow

Every story gets a **story-specific markdown file** in `docs/stories/S-XXXX-<short-name>.md`. This file is the single source of truth for the story's plan, progress, and resumption context. It must be kept up to date during both planning and implementation.

### Story file structure

```markdown
# S-XXXX: <Title>

## Status: Planning | In Progress | Blocked | Complete

## Overview
<!-- 2-3 sentence summary of what this story delivers and why -->

## Key decisions
<!-- Architectural/design choices that affect implementation -->
- Decision: <what> — Chosen: <choice> — Why: <rationale>

## Phase 1: <Phase Name>
**Goal:** <What this phase achieves>
**Files touched:** `path/to/file.ts`, `path/to/other.ts`

- [ ] **Task 1.1: <Imperative title>**
  - Acceptance: <How to verify this is done>
  - [ ] Subtask: <specific step>
  - [ ] Subtask: <specific step>
- [ ] **Task 1.2: <Imperative title>**
  - Acceptance: <How to verify this is done>

## Phase 2: ...

## Resume context
<!-- Updated after each work session, before compaction, or when handing off -->
### Last completed
- <What was just finished, with file paths>
### In progress
- <What is currently being worked on, partial state details>
- Current file: `path/to/file.ts` — <what was done, what remains>
### Next up
- <Next task to pick up>
### Blockers / open questions
- <Anything unresolved>

## Test summary
<!-- Updated as tests are written -->
- **Unit**: X total (Y new)
- **Integration**: X total (Y new)
- **E2E**: X total (Y new)
```

### Structure rules

1. **Decompose aggressively.** Every phase should have 2-6 tasks. If a task has more than 3 subtasks, consider splitting it into its own task. Any single task should be completable in one focused session without losing context.
2. **Files touched per phase.** List every file that will be created or modified so anyone jumping in knows exactly where to look.
3. **Acceptance criteria on every task.** Not just "create X" — state how to verify it's correct (e.g., "unit tests pass", "route returns 200 with expected shape", "page renders with seeded data").
4. **Key decisions up front.** Record architectural choices during planning so implementation doesn't stall on ambiguity. Add new decisions as they arise during implementation.
5. **Resume context is mandatory.** This section must be updated before ending a session, when context is getting long, or before any handoff. It should contain enough detail that a fresh Claude instance or a teammate can continue without re-reading the entire conversation.

### Workflow

1. **Start of story:** Read the story file. If it doesn't exist, create it using the structure above (plan mode or not). Set status to `Planning` or `In Progress`.
2. **Check resume context:** If the "Resume context" section is populated, start from where it left off rather than scanning all checkboxes.
3. **Work through tasks:** Find the first unchecked item, complete it, mark it `[x]`.
4. **Record problems:** If a step fails or needs adjustment, note it in the story file before continuing.
5. **Keep resume context fresh:** Before context gets long, before ending a session, or before any handoff, update the "Resume context" section with:
   - What was just completed (with file paths)
   - What is partially done (with specific details about current state)
   - What to do next
   - Any blockers or open questions
6. **Commit after each phase:** When a phase is complete, use the Task tool (subagent) to create a commit. The subagent must:
   - Read the current story file (`docs/stories/S-XXXX-*.md`) for phase context
   - Run `git diff HEAD` to see what changed since the last commit
   - Run `git log -1 --stat` to see the previous commit's scope for comparison
   - Run `git log --oneline -5` to match existing commit message style
   - Stage all relevant files (`git add` specific files, not `-A`)
   - Write a commit message that references the story and phase (e.g., `S-0009 phase 2: Add QuoteRepository port and Drizzle implementation`)
   - The commit message body should briefly list what was done in the phase
   - Do NOT push to remote — only commit locally
7. **Finish:** After all phases complete, set status to `Complete` and clear the "Resume context" section.
