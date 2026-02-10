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
| Nav order | Dashboard, Services, Requests, Clients, then remaining items | S-0004 | Services + Clients are setup-phase items; Requests inserted in S-0006 |
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
| Convert redirect | Client detail page | S-0008 | Quote detail page doesn't exist until S-0009; revisit then |
| Name splitting | Split on last space | S-0008 | "Sarah Jane Davis" → "Sarah Jane" / "Davis"; single word → all firstName |

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
| Request `updateStatus` | S-0008 | `RequestRepository.updateStatus(tenantId, id, status)` for status transitions (e.g., `new` → `converted`) |
| Composite convert endpoint | S-0008 | `POST /v1/requests/:id/convert` returns 200 (not 201) with `{ request, client, property, quote, clientCreated }` |
| Existing client match on convert | S-0008 | Optional `existingClientId` skips client creation; frontend searches by email with debounced query |

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

### Testing

| Pattern | Story | Description |
|---------|-------|-------------|
| E2E DB isolation | S-0002 | `db:reset` → `db:push` → `db:seed` in globalSetup |
| Cross-project skip | S-0002 | `test.skip(testInfo.project.name !== 'desktop-chrome', 'reason')` inside test body |
| Integration DB sharing | S-0001 | `pool: 'forks'` + `singleFork: true` in vitest config |

---

## Deferred to later stories

| Item | Deferred to | Reason |
|------|-------------|--------|
| Cognito JWT validation (`AUTH_MODE=cognito`) | S-0007+ | S-0001–S-0008 use `AUTH_MODE=local` |
| SMS worker (send from outbox) | S-0021 | `message_outbox` table exists; SMS records queued but not sent |
| `secure_link_tokens` table | S-0010 | Not needed until external access stories |
| LocalStack in docker-compose | S-0007+ | Not needed until async/queue stories |
| EventBridge bus + Scheduler | S-0022+ | Not needed until automation stories |
| Stripe integration | S-0018 | |
| CI/CD pipeline | Post-MVP | Context gap #6 |
| Testcontainers | When CI needs self-contained DB | Reuse docker-compose Postgres for now |

---

## Story implementation workflow

Every story gets a **story-specific markdown file** in `docs/stories/S-XXXX-<short-name>.md` with item-by-item checkboxes.

**When implementing a story:**
1. Read the story markdown file for the current checklist state
2. Find the first unchecked item and start there
3. Check off items as you complete them
4. If a step fails or needs adjustment, note it in the file before continuing
