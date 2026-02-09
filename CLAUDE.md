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
| Auth provider | AWS Cognito (User Pools, JWT) | Pre-S-001 | `AUTH_MODE=local` mock for dev; see Architecture doc 4.1 |
| DB query layer | Drizzle ORM + drizzle-kit | S-001 | Type-safe, SQL-like API, built-in migrations |
| Logging | Pino (structured JSON) | S-001 | Config object, not instance (Fastify 5 requirement) |
| API framework | Fastify 5 + Zod schemas | S-001 | `fastify-type-provider-zod` (NOT `@fastify/` scoped) |
| Frontend | React 19 + Vite + Tailwind CSS v4 + shadcn/ui | S-001 | `@tailwindcss/vite` plugin; hand-written components |
| Monorepo | pnpm workspaces, Node 24 | S-001 | `--env-file=../../.env` for tsx scripts (no dotenv) |
| Testing | Vitest + Playwright + axe-core | S-001 | |
| DB schema management | `db:push` (local), `db:generate` + `db:migrate` (prod) | S-001 | Migrations introduced as schema evolves |
| Service catalog | Two-level: categories → items | S-003 | Soft delete via `active` flag; prices in integer cents |
| Nav order | Dashboard, Services, then remaining items | S-003 | Services is a setup-phase item owners configure early |

---

## Established patterns

### Backend

| Pattern | Story | Description |
|---------|-------|-------------|
| UnitOfWork for atomic writes | S-001 | `UnitOfWork` port + `DrizzleUnitOfWork`; use cases take `(readRepo, uow)` |
| Defensive unique-constraint catch | S-001 | Wrap `uow.run()` in try/catch; map SQL state `23505` → `ConflictError` via `isUniqueViolation()` |
| Singleton upsert | S-002 | `onConflictDoUpdate` on unique `tenant_id` constraint; no UoW needed |
| Audit event derivation | S-002 | Compare `createdAt` vs `updatedAt` timestamps to determine created/updated event |
| GET returns null on empty | S-002 | Return `null` with 200 for "not yet configured" singletons, not 404 |
| Read-only routes skip use cases | S-003 | List/getById call repo directly in route handlers |
| Soft delete via active flag | S-003 | Set `active = false`, return 204; parent deactivation cascades to children |
| Price in integer cents | S-003 | Store cents in DB, dollars in UI; `dollarsToCents()` / `centsToDollars()` |
| DELETE returns 204 | S-003 | Frontend `request()` handles 204 by returning `undefined` |

### Frontend

| Pattern | Story | Description |
|---------|-------|-------------|
| Wizard as `<div>` not `<form>` | S-002 | Native inputs trigger implicit submit in `<form>`; use explicit `onClick` |
| Local auth override via headers | S-002 | `X-Dev-Tenant-Id` / `X-Dev-User-Id` in localStorage, sent on all requests |
| Scroll container is `<main>` | S-002 | `document.querySelector('main')?.scrollTo()`, not `window.scrollTo()` |
| Loading skeletons | S-002 | `Skeleton` component for async data loading states |
| Dollar/cents conversion | S-003 | Convert before API calls and after responses |
| E2E scoped locators | S-003 | Use `.filter({ hasText: ... })` when seed/test data coexist |

### Testing

| Pattern | Story | Description |
|---------|-------|-------------|
| E2E DB isolation | S-002 | `db:reset` → `db:push` → `db:seed` in globalSetup |
| Cross-project skip | S-002 | `test.skip(testInfo.project.name !== 'desktop-chrome', 'reason')` inside test body |
| Integration DB sharing | S-001 | `pool: 'forks'` + `singleFork: true` in vitest config |

---

## Deferred to later stories

| Item | Deferred to | Reason |
|------|-------------|--------|
| Cognito JWT validation (`AUTH_MODE=cognito`) | S-004+ | S-001–S-003 use `AUTH_MODE=local` |
| `message_outbox` table | S-021 | Not needed until comms stories |
| `secure_link_tokens` table | S-010 | Not needed until external access stories |
| LocalStack in docker-compose | S-007+ | Not needed until async/queue stories |
| EventBridge bus + Scheduler | S-022+ | Not needed until automation stories |
| Stripe integration | S-018 | |
| CI/CD pipeline | Post-MVP | Context gap #6 |
| Testcontainers | When CI needs self-contained DB | Reuse docker-compose Postgres for now |

---

## Story implementation workflow

Every story gets a **story-specific markdown file** in `docs/stories/S-XXX-<short-name>.md` with item-by-item checkboxes.

**When implementing a story:**
1. Read the story markdown file for the current checklist state
2. Find the first unchecked item and start there
3. Check off items as you complete them
4. If a step fails or needs adjustment, note it in the file before continuing
