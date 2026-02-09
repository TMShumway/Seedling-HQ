# Claude.md — Seedling-HQ AI Context Index

> Purpose: This file is the **entry point** for AI-driven development in Seedling-HQ.  
> It points to the project’s authoritative context packs.  
>
> Usage:
> - **Read these files first** (in order) before making design or implementation decisions.
> - When implementing a story, keep the constraints and “Definition of Done” in mind:
>   - AWS-first + local-first dev
>   - spec-driven (OpenAPI → generated TS client)
>   - multi-tenant safety
>   - external secure-link safety
>   - responsive + accessible UI
>   - tests required for pitfalls (tenancy, secure links, async/idempotency)

---

## 1) Core architecture + dev sandbox

**File:** `seedling-hq_mvp-context_architecture_dev-sandbox_UPDATED.md`  
**What it covers:** system architecture, naming conventions, LocalStack/local dev contract, AWS CDK dev sandbox stack, env vars, and overall MVP flows.

---

## 2) UI/UX system (Tailwind + shadcn/ui)

**File:** `seedling-hq_ui-ux-context_tailwind-shadcn_ai-dev.md`  
**What it covers:** responsive “no mobile app” strategy, USWDS-inspired UX principles, component inventory, screen patterns for MVP spine, and required a11y + responsive audits.

---

## 3) Testing strategy (Vitest + Playwright + a11y)

**File:** `seedling-hq_testing-context_vitest_playwright_ai-dev_TDD.md`  
**What it covers:** test pyramid, required invariants, cross-tenant denial tests, secure-link scope/object binding tests, async worker/outbox idempotency tests, and Playwright + axe accessibility checks.

---

## 4) Security baseline (beyond stories)

**File:** `seedling-hq_security-baseline_context_ai-dev.md`  
**What it covers:** principal types (internal vs external), secure-link token policy (tenant/object/scope-bound, hashing, expiry, revocation), logging redaction, PII handling, upload security, secrets policy, IAM least privilege, and security audit cadence.

---

## 5) Observability + telemetry spec

**File:** `seedling-hq_observability-telemetry-spec_context_ai-dev.md`  
**What it covers:** correlation IDs, structured logging schema, metrics spec (API + worker + outcomes), audit event schema, product telemetry event vocabulary, dashboards/alerts, and async observability (outbox, scheduler, DLQs).

---

## 6) Documentation gaps tracker (for planning)

**File:** `seedling-hq_context-gaps_next-docs_team-share.md`  
**What it covers:** what context documentation is still missing, with prioritized next docs to create.

---
---

## 7) DevEx + Clean Architecture rails

**File:** `seedling-hq_devex-repo-conventions_clean-architecture_ai-dev_TDD.md`  
**What it covers:** Clean Architecture boundaries, repository and feature-building rails, and default **TDD workflow** expectations.

---

## 8) Data access + tenancy enforcement

**File:** `seedling-hq_data-access_tenancy-enforcement_clean-architecture_ai-dev.md`  
**What it covers:** tenant-safe repository method signatures, per-tenant indexes/constraints, secure link token storage rules, outbox idempotency, and S3 tenant prefix conventions.


## How to apply these docs when building

### When adding/altering an API endpoint
- Use the **Architecture** doc to follow OpenAPI-first workflow and local dev contract.
- Use the **Security Baseline** doc to enforce tenant boundaries and secure-link rules.
- Use the **Observability** doc to add correlation IDs, logs, metrics, and audit events.
- Use the **Testing** doc to add cross-tenant + auth/scope + integration/E2E tests.

### When adding/altering UI
- Use the **UI/UX** doc for shell/layout patterns and component inventory.
- Use the **Testing** doc for Playwright responsive + a11y checks.
- Use the **Observability** doc for minimal client telemetry (no PII, no tokens).

### When adding async jobs, reminders, or comms
- Use the **Architecture** doc for SQS/Scheduler/outbox patterns.
- Use the **Security Baseline** doc for PII/log redaction and secrets.
- Use the **Observability** doc for worker metrics, DLQ alerts, and correlation propagation.
- Use the **Testing** doc for idempotency + retry behavior.

---

## File locations

These context packs are currently distributed as standalone markdown files.  
If they are not already committed in the repo, copy them into a `/docs/context/` directory and keep this index up to date.

Recommended repo layout:
```
docs/context/
  seedling-hq_mvp-context_architecture_dev-sandbox_UPDATED.md
  seedling-hq_ui-ux-context_tailwind-shadcn_ai-dev.md
  seedling-hq_testing-context_vitest_playwright_ai-dev_TDD.md
  seedling-hq_security-baseline_context_ai-dev.md
  seedling-hq_observability-telemetry-spec_context_ai-dev.md
  seedling-hq_devex-repo-conventions_clean-architecture_ai-dev_TDD.md
  seedling-hq_data-access_tenancy-enforcement_clean-architecture_ai-dev.md
  seedling-hq_context-gaps_next-docs_team-share.md
docs/stories/
  S-001-business-signup-first-tenant.md
  S-002-onboarding-wizard.md          # (created per story)
  ...
Claude.md
```

---

## Non-negotiable MVP reminders

- **Tenant = internal customer (business).** External customers are tenant-owned records.
- External access is via **tenant-bound, object-bound, scope-bound secure links** (token hashed + expiry + revocation).
- **Outbound SMS + automation/reminders are MVP requirements.**
- Every story must work in **local dev** and include **tests** and **a11y/responsive checks**.
- Default workflow is **TDD-first** for domain + use cases (see DevEx doc).

---

## Key design decisions (resolved)

| Decision | Choice | Story | Notes |
|----------|--------|-------|-------|
| Auth provider | AWS Cognito (User Pools, JWT) | Pre-S-001 | `AUTH_MODE=local` mock for dev; see Architecture doc 4.1 |
| DB query layer | Drizzle ORM + drizzle-kit | S-001 | Type-safe, SQL-like API, built-in migrations |
| Logging | Pino (structured JSON) | S-001 | |
| API framework | Fastify 5 + Zod schemas | S-001 | With `@fastify/swagger` for OpenAPI generation |
| Frontend | React 19 + Vite + Tailwind CSS v4 + shadcn/ui | S-001 | |
| Monorepo | pnpm workspaces | S-001 | |
| Testing | Vitest (unit/integration) + Playwright (E2E) + axe-core (a11y) | S-001 | |
| DB schema management | `db:push` for local dev, `db:generate` + `db:migrate` for prod | S-001 | Migrations introduced as schema evolves |
| Transaction strategy | UnitOfWork port + `DrizzleUnitOfWork` | S-001 | Wraps `db.transaction()`; provides transaction-scoped repos to use cases |
| Business settings | Singleton upsert via `PUT /v1/tenants/me/settings` | S-002 | JSONB business hours; `onConflictDoUpdate` on unique `tenant_id`; no UoW needed |
| Wizard form pattern | `<div>` wrapper, not `<form>` | S-002 | Native inputs (time, number) trigger implicit submit in `<form>`; use explicit `onClick` |
| E2E DB isolation | `db:reset` → `db:push` → `db:seed` in globalSetup | S-002 | Truncates all tables before each E2E run for clean state |
| Local auth override | `X-Dev-Tenant-Id` / `X-Dev-User-Id` headers | S-002 | Frontend stores signup IDs in localStorage; backend overrides env var defaults per-request |
| Service catalog structure | Two-level: categories → service items | S-003 | Soft delete via `active` flag; prices in integer cents |
| Price storage | Integer (cents) in DB, dollars in UI | S-003 | Avoids floating-point precision; frontend converts |
| Unit types | String enum: flat, hourly, per_sqft, per_unit, per_visit | S-003 | Fixed set in code, varchar in DB |
| Read use cases | Direct repo calls in route handlers | S-003 | No business logic for reads; avoids boilerplate wrappers |
| Nav placement | Services after Dashboard, before Requests | S-003 | Setup-phase item owners configure early |

## Deferred to later stories

| Item | Deferred to | Reason |
|------|-------------|--------|
| Cognito JWT validation (`AUTH_MODE=cognito`) | S-004+ | S-001/S-002/S-003 use `AUTH_MODE=local`; Cognito infra in CDK sandbox |
| `message_outbox` table | S-021 (Outbox + worker) | Not needed until comms stories |
| `secure_link_tokens` table | S-010 (Send secure quote link) | Not needed until external access stories |
| LocalStack in docker-compose | S-007+ (notifications, SQS) | Not needed until async/queue stories |
| EventBridge bus + Scheduler | S-022+ (reminders) | Not needed until automation stories |
| Stripe integration | S-018 (Customer pays invoice) | |
| CI/CD pipeline | Post-MVP scaffolding | Context gap #6 |
| Testcontainers | When CI needs self-contained DB | Reuse docker-compose Postgres for now |

---

## Story implementation workflow

Every story gets a **story-specific markdown file** in `docs/stories/` with item-by-item checkboxes. This file:
- Acts as a resumable checklist — development can be picked up at any point
- Is created **before** implementation begins (during planning)
- Is checked off as each step is completed
- Documents story-specific design decisions and deferred items

**File convention:** `docs/stories/S-XXX-<short-name>.md`

**When implementing a story:**
1. Read the story markdown file for the current checklist state
2. Find the first unchecked item and start there
3. Check off items as you complete them
4. If a step fails or needs adjustment, note it in the file before continuing
