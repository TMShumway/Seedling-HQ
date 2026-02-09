# Seedling-HQ — Context Documentation Gaps & Next Files to Add (Team Share)

_Last updated: 2026-02-08 (America/Chihuahua)_

> Purpose: Share this with the team to identify what context documentation is still missing for AI-Driven Development and consistent engineering.

## Current context files (what’s already strong)

Seedling-HQ currently has eight context packs:

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

This foundation is strong. What remains are the "rails" that prevent agents (and humans) from inventing inconsistent patterns.

### Recently resolved decisions
- **Internal auth mechanism (2026-02-08):** AWS Cognito chosen. Documented in Architecture doc Section 4.1, Security Baseline Section 3.2/3.4, DevEx Section 5.2. Resolves Architecture doc Section 15F open risk.
- **S-002 implemented (2026-02-08):** Business settings CRUD (singleton upsert pattern), onboarding wizard, settings page. Introduces `BusinessSettings`, `DaySchedule`, `BusinessHours` domain entities. Establishes patterns: singleton upsert via `onConflictDoUpdate`, GET-returns-null-on-empty, wizard `<div>` (not `<form>`), `db:reset` for E2E isolation.
- **S-003 implemented (2026-02-08):** Service catalog (price book v1). Two-level hierarchy: `ServiceCategory` → `ServiceItem`. Prices stored as integer cents, soft delete via `active` boolean. Unit types: flat/hourly/per_sqft/per_unit/per_visit. Establishes patterns: read-only routes skip use cases (direct repo calls), DELETE returns 204, dollar↔cents conversion in frontend, E2E scoped locators via `.filter({ hasText })`, defensive unique-constraint catch with `isUniqueViolation()`.

---

## Biggest gaps (high leverage to document next)

### 1) Domain model + canonical status/state machines
Agents know the flows and screens, but not the canonical shapes and transitions.

> **Partial progress:** S-001 defined Tenant + User entities. S-002 added BusinessSettings, DaySchedule, BusinessHours. S-003 added ServiceCategory, ServiceItem, UnitType.
> Remaining: full status machines for Request, Quote, Job, Visit, Invoice and audit event catalog.

Add a context file that defines:
- Core entities and minimal fields:
  - ~~Tenant, User~~ (S-001), ~~BusinessSettings~~ (S-002), ~~ServiceCategory, ServiceItem~~ (S-003), Client, Property, Request, Quote, Job, Visit, Invoice, MessageOutbox, SecureLinkToken
- Status enums + allowed transitions:
  - Example: Quote `Draft → Sent → Approved/Declined`
  - Example: Invoice `Draft → Sent → Paid/Overdue`
- Audit/event names and when they fire:
  - e.g., `quote.sent`, `quote.viewed`, `invoice.paid`
- “Source of truth” rules:
  - message_outbox is durable truth for outbound comms
  - secure-link token table is truth for external links

### 2) API standards and conventions (behavioral contract)
You’re OpenAPI-driven, but conventions aren’t spelled out yet.

Add definitions for:
- Standard error shape (e.g., problem+json style), error codes, field errors
- Pagination pattern (cursor vs page), default limits, sorting/filtering conventions
- Idempotency rules: where required and how to implement (keys/headers)
- Auth context contract (internal vs external principal), how it is represented on requests
  > **Partial resolution (2026-02-08):** Auth mechanism decided — AWS Cognito for internal users.
  > Auth context contract for internal principals is now documented in Architecture doc (Section 4.1) and DevEx doc (Section 5.2).
  > S-002 establishes precedents: idempotent `PUT` for singleton upsert, `GET` returns `null` (200) when entity doesn't exist.
  > Remaining sub-gap: full API standards doc (errors, pagination, idempotency) still needed.
- Tenant resolution rules for internal vs external endpoints

### ~~3) Data access patterns + tenancy enforcement~~ — DONE
> Covered by: `seedling-hq_data-access_tenancy-enforcement_clean-architecture_ai-dev.md`
> ~~Remaining sub-gap: ORM/query builder choice and migration tooling are not yet decided.~~ Resolved in S-001: Drizzle ORM + drizzle-kit.

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
> ~~Remaining sub-gaps: concrete logging library choice~~ Resolved in S-001: Pino (structured JSON). Remaining sub-gaps: CloudWatch EMF code patterns, client-side error tracking approach.

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
You reference Stripe, SES, SMS v2, but don’t define operational expectations.

Document:
- SMS v2 origination identity setup and safe-guards to prevent accidental sending in dev
- SES identity/domain setup expectations
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

1) **Domain Model + Status/Transitions + Audit/Event Catalog**
2) **API Standards (errors, pagination, auth context, idempotency)**
3) ~~Data Access + Tenancy Enforcement~~ — DONE
4) ~~Security Baseline~~ — DONE
5) ~~DevEx/Repo Conventions for Agents~~ — DONE
6) **CI/CD + Environment Matrix**
7) ~~Observability + Telemetry Spec~~ — DONE
8) **Automation Policy (cadences + cancellation keys + schedules)**
9) **Comms + Payments Ops Notes (Stripe/SES/SMS setup)**

**Remaining (5 of 9):** items 1, 2, 6, 8, 9 above.

---

## Suggested next step (team decision)

Decide if you want:
- **Many small context docs** (easier to update, more modular), OR
- **One consolidated “Engineering Standards for AI Agents”** doc that merges items (2)–(5)

Either approach works; the goal is to remove ambiguity so both humans and AI agents build consistently.
