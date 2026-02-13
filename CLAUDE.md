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
| 11 | **Design decisions** | `design-decisions.md` | All resolved architectural/design choices by story |
| 12 | **Established patterns** | `established-patterns.md` | Backend, frontend, and testing pattern catalog |
| 13 | **Story workflow** | `story-workflow.md` | Story file template, structure rules, commit workflow |

### Which docs to read for common tasks

| Task | Read these docs |
|------|----------------|
| Adding/altering an API endpoint | #1, #10, #9, #4, #5, #3, #11, #12 |
| Adding/altering UI | #2, #3, #5, #12 |
| Adding async jobs, reminders, or comms | #1, #4, #5, #3 |
| Adding a new entity or status machine | #9, #8, #10, #3 |
| Adding external/secure-link endpoints | #4, #8, #10, #1, #3 |
| Starting a new story | #13 (story workflow) |

---

## Non-negotiable MVP reminders

- **Tenant = internal customer (business).** External customers are tenant-owned records.
- External access is via **tenant-bound, object-bound, scope-bound secure links** (token hashed + expiry + revocation).
- **Outbound SMS + automation/reminders are MVP requirements.**
- Every story must work in **local dev** and include **tests** and **a11y/responsive checks**.
- Default workflow is **TDD-first** for domain + use cases (see DevEx doc #7).

---

## Testing patterns (quick reference)

| Pattern | Story | Description |
|---------|-------|-------------|
| E2E DB isolation | S-0002 | `db:reset` → `db:push` → `db:seed` in globalSetup |
| Cross-project skip | S-0002 | `test.skip(testInfo.project.name !== 'desktop-chrome', 'reason')` inside test body |
| Integration DB sharing | S-0001 | `pool: 'forks'` + `singleFork: true` in vitest config |
| `setDemoAuth` E2E helper | S-0027/S-0031 | `e2e/helpers/auth.ts` — `page.addInitScript()` sets demo localStorage (tenant_id, user_id, role, name, tenant_name) before every page load; add to `test.beforeEach` in all authenticated E2E tests |
| Logout E2E uses `page.evaluate` | S-0027 | Don't use `addInitScript` when testing logout — it re-sets localStorage on navigation; use `page.evaluate(() => localStorage.setItem(...))` instead |
| E2E test isolation via dedicated seed data | S-0015 | When test file A mutates seeded data that test file B depends on, seed separate data for B. Today tests use John Smith's visit (2 PM) instead of Jane Johnson's (9 AM) which schedule.spec.ts mutates |
| Scoped E2E locators within cards | S-0015 | Use `page.getByTestId('card').filter({ hasText: 'Name' })` then scope button clicks within that card to avoid cross-card interference |

---

## Deferred to later stories

| Item | Deferred to | Reason |
|------|-------------|--------|
| SMS worker (send from outbox) | S-0021 | `message_outbox` table exists; SMS records queued but not sent |
| EventBridge bus + Scheduler | S-0022+ | Not needed until automation stories |
| Stripe integration | S-0018 | |
| CI/CD pipeline | Post-MVP | Context gap #6 |
| Testcontainers | When CI needs self-contained DB | Reuse docker-compose Postgres for now |
