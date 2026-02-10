# Seedling-HQ — Context Documentation Gaps & Next Files to Add (Team Share)

_Last updated: 2026-02-09 (America/Chihuahua)_

> Purpose: Share this with the team to identify what context documentation is still missing for AI-Driven Development and consistent engineering.

## Current context files (what’s already strong)

Seedling-HQ currently has ten context packs:

1) **Architecture + naming + dev sandbox**
   - Infra patterns (AWS-first), local-first dev contract, comms/automation flows
   - Multi-tenancy rules (tenant = internal customer) and secure-link guidance
   - **Auth mechanism**: AWS Cognito for internal users (JWT-based), with `AUTH_MODE=local` mock for dev

2) **UI/UX context (Tailwind + shadcn/ui)**
   - Responsive "no mobile app" strategy
   - Accessibility-first patterns and an audit cadence

3) **Testing context (Vitest + Playwright + a11y)**
   - Test pyramid and required invariants for:
     - multi-tenancy
     - secure links
     - async worker/outbox
     - reminders/scheduler
     - mobile + accessibility

4) **Security baseline (MVP)**
   - Token hashing strategy, PII/logging redaction, IAM least privilege
   - Secure-link token policy, threat model, audit events

5) **Observability + telemetry spec**
   - Correlation IDs, structured logging schema, metrics spec
   - Audit event schema, dashboards/alerts, async flow observability

6) **Context gaps tracker** _(this file)_

7) **DevEx + Clean Architecture rails**
   - Clean Architecture boundaries, folder structure, feature-building checklist
   - TDD workflow, routing conventions, error handling strategy

8) **Data access + tenancy enforcement**
   - Repository port patterns (tenantId-first signatures), index strategy
   - Secure-link token storage, outbox data model, S3 keying rules

9) **Domain model + status machines + audit catalog**
   - Implemented entity definitions (through S-0009) and planned entity definitions with status machines
   - Audit event catalog (20 implemented + 14 planned), entity relationships

10) **API standards (errors, pagination, idempotency)**
    - Error shape and codes, response conventions, auth context contract
    - Pagination strategy, filtering patterns, idempotency rules

This foundation is strong. What remains are the "rails" that prevent agents (and humans) from inventing inconsistent patterns.

### Recently resolved decisions
- **Internal auth mechanism (2026-02-08):** AWS Cognito chosen. Documented in Architecture doc Section 4.1, Security Baseline Section 3.2/3.4, DevEx Section 5.2. Resolves Architecture doc Section 15F open risk.
- **S-0002 implemented (2026-02-08):** Business settings CRUD (singleton upsert pattern), onboarding wizard, settings page. Introduces `BusinessSettings`, `DaySchedule`, `BusinessHours` domain entities. Establishes patterns: singleton upsert via `onConflictDoUpdate`, GET-returns-null-on-empty, wizard `<div>` (not `<form>`), `db:reset` for E2E isolation.
- **S-0003 implemented (2026-02-08):** Service catalog (price book v1). Two-level hierarchy: `ServiceCategory` → `ServiceItem`. Prices stored as integer cents, soft delete via `active` boolean with cascade (deactivating a category also deactivates its items via `deactivateByCategoryId`). Unit types: flat/hourly/per_sqft/per_unit/per_visit. Establishes patterns: read-only routes skip use cases (direct repo calls), DELETE returns 204, dollar↔cents conversion in frontend, E2E scoped locators via `.filter({ hasText })`, defensive unique-constraint catch with `isUniqueViolation()`.
- **S-0004 implemented (2026-02-09):** Client + Property management (CRM layer). Two-level hierarchy: `Client` → `Property`. Soft delete with cascade (deactivating a client also deactivates its properties). Introduces cursor-based pagination (`PaginatedResult<T>` with keyset on `(created_at DESC, id DESC)`), server-side ILIKE search across multiple columns, count endpoint for dashboard metrics, nested+flat URL pattern (properties listed under client, operated individually). Frontend uses `useInfiniteQuery` for "Load More" pagination with debounced search.
- **S-0005 implemented (2026-02-09):** Client timeline with tab layout. Reuses `audit_events` table with composite index `(tenant_id, subject_type, subject_id, created_at)`. Tab layout with ARIA roles on client detail page (Info / Properties / Activity). `getEventLabel()` maps event names to human-readable labels.
- **S-0006 implemented (2026-02-09):** Public request form. `POST /v1/public/requests/:tenantSlug` with honeypot spam protection and in-memory sliding-window rate limiter. Request status machine: `new` → `reviewed` → `converted` / `declined`. Tenant resolution via slug. System audit principal for public actions.
- **S-0007 implemented (2026-02-09):** New request notifications. First outbound comms story. Introduces `message_outbox` table and `MessageOutbox` entity. Email sent immediately via Nodemailer (Mailpit locally), SMS records queued for S-0021 worker. `SendRequestNotificationUseCase` is best-effort (wraps all logic in try/catch, never throws). Config toggle: `NOTIFICATION_ENABLED`. 100 unit, 91 integration, 43 E2E tests passing.
- **S-0008 implemented (2026-02-09):** Convert request to client + quote draft. First cross-entity atomic operation. Introduces `quotes` table and `Quote` entity with `QuoteRepository`. Extends `TransactionRepos` to 7 repos. `ConvertRequestUseCase` atomically creates client + property + quote draft + updates request status inside `uow.run()`. Status gate: only `new`/`reviewed` requests convertible. Frontend: `RequestDetailPage`, `ConvertRequestPage` with name splitting and existing-client email search. 100 unit, 91 integration, 43 E2E tests passing.
- **S-0009 implemented (2026-02-10):** Quote builder v1. Extends `QuoteRepository` with `list` and `update` methods. `UpdateQuoteUseCase` with draft-only edit guard, line item validation, and total recomputation. 4 new API endpoints: `GET /v1/quotes` (paginated list with status/search filters), `GET /v1/quotes/count`, `GET /v1/quotes/:id`, `PUT /v1/quotes/:id`. Frontend: `QuotesPage` with status filter pills and debounced search, `QuoteDetailPage` with inline line-item builder, `ServiceItemPicker` from catalog, editable tax. Convert redirect changed from `/clients/:id` to `/quotes/:id`. 114 unit, 104 integration, 48+22 skipped E2E tests passing.

---

## Biggest gaps (high leverage to document next)

### ~~1) Domain model + canonical status/state machines~~ — DONE
> Covered by: `seedling-hq_domain-model_status-machines_audit-catalog.md`
> Defines all implemented entities (Tenant, User, BusinessSettings, ServiceCategory, ServiceItem, Client, Property, Request, MessageOutbox, Quote) with full field lists, planned entities with status machines (Job, Visit, Invoice), audit event catalog (20 implemented + 14 planned), entity relationships, and source-of-truth rules.

### ~~2) API standards and conventions (behavioral contract)~~ — DONE
> Covered by: `seedling-hq_api-standards_errors_pagination_idempotency.md`
> Defines standard error shape (`{ error: { code, message } }`), error codes (VALIDATION_ERROR, UNAUTHORIZED, NOT_FOUND, CONFLICT, INTERNAL_ERROR), response conventions (200/201/204/null), auth context contract, cursor-based pagination strategy, filtering patterns, idempotency rules, and URL/naming conventions.

### ~~3) Data access patterns + tenancy enforcement~~ — DONE
> Covered by: `seedling-hq_data-access_tenancy-enforcement_clean-architecture_ai-dev.md`
> ~~Remaining sub-gap: ORM/query builder choice and migration tooling are not yet decided.~~ Resolved in S-0001: Drizzle ORM + drizzle-kit.

### ~~4) Security baseline beyond stories~~ — DONE
> Covered by: `seedling-hq_security-baseline_context_ai-dev.md`
> Remaining sub-gaps: concrete CORS allowed origins, CSRF decision, CSP policy details.

### ~~5) DevEx + repo conventions for AI agents~~ — DONE
> Covered by: `seedling-hq_devex-repo-conventions_clean-architecture_ai-dev_TDD.md`
> Remaining sub-gaps: formatting/linting tool config, UI component location conventions.

### 6) CI/CD + environments matrix
You have CDK sandbox infra, but not the end-to-end deployment posture.

Document:
- CI pipeline steps (exact commands) for:
  - web, api, worker, migrations, e2e
- Environment matrix:
  - local / dev sandbox / staging / prod differences
- Migration execution strategy:
  - who runs migrations and when (deploy step vs manual)
- Preview deploy strategy (optional)

### ~~7) Observability + telemetry specification~~ — DONE
> Covered by: `seedling-hq_observability-telemetry-spec_context_ai-dev.md`
> ~~Remaining sub-gaps: concrete logging library choice~~ Resolved in S-0001: Pino (structured JSON). Remaining sub-gaps: CloudWatch EMF code patterns, client-side error tracking approach.

### 8) Automation/reminders policy (cadences + cancellation keys)
MVP requires automation, but exact defaults and cancelation rules aren’t a single source of truth.

Document:
- Default cadences:
  - appointment reminders, quote follow-ups, invoice reminders
- Cancelation rules:
  - “stop on approve/decline”, “stop on paid”, “reschedule updates reminders”
- Deterministic schedule key format:
  - so cancelation is reliable and testable

### 9) Comms + payments operational setup notes (dev/staging hygiene)
You reference Stripe, SES, SMS v2, but don't define operational expectations.

> **Partially resolved by S-0007:** Local email sending via Nodemailer → Mailpit is implemented. `NOTIFICATION_ENABLED` toggle, `SMTP_*` config vars, and `SendRequestNotificationUseCase` pattern established. SMS outbox records are created (queued) but not sent yet (S-0021).

Remaining items to document:
- SMS v2 origination identity setup and safe-guards to prevent accidental sending in dev
- SES identity/domain setup for prod email (replacing local Nodemailer)
- Stripe webhook verification + idempotency strategy (event IDs storage)

---

## Smaller gaps (nice-to-have, but prevents UX drift)

- Copy/voice guidelines:
  - button labels, error tone, empty state voice
- Final UI tokens for USWDS-inspired theme:
  - type ramp, spacing scale, border radii, focus ring style
- Calendar UI component choice:
  - interaction rules (drag/drop, conflict UX)

---

## Recommended "next context files" (priority order)

1) ~~Domain Model + Status/Transitions + Audit/Event Catalog~~ — DONE
2) ~~API Standards (errors, pagination, auth context, idempotency)~~ — DONE
3) ~~Data Access + Tenancy Enforcement~~ — DONE
4) ~~Security Baseline~~ — DONE
5) ~~DevEx/Repo Conventions for Agents~~ — DONE
6) **CI/CD + Environment Matrix**
7) ~~Observability + Telemetry Spec~~ — DONE
8) **Automation Policy (cadences + cancellation keys + schedules)**
9) **Comms + Payments Ops Notes (Stripe/SES/SMS setup)**

**Remaining (3 of 9):** items 6, 8, 9 above.

---

## Suggested next step (team decision)

Decide if you want:
- **Many small context docs** (easier to update, more modular), OR
- **One consolidated “Engineering Standards for AI Agents”** doc that merges items (2)–(5)

Either approach works; the goal is to remove ambiguity so both humans and AI agents build consistently.
