# Seedling-HQ — Data Access + Tenancy Enforcement (Clean Architecture Ports) for AI-Driven Development

_Last updated: 2026-02-08 (America/Chihuahua)_

> Purpose: Define **how data access works** and exactly **how tenancy is enforced** so agents don’t invent patterns.
> This doc complements the Architecture, Security, Testing, and Observability context packs.

---

## 1) Tenancy rules (non-negotiable)

- **Tenant = internal customer (business).**
- All tenant-owned tables must include `tenant_id`.
- Every query must be tenant-scoped:
  - `WHERE tenant_id = :tenantId`
- External secure-link requests must derive `tenant_id` from the token record, not from params.

---

## 2) Clean Architecture “ports” for data access

### 2.1 Port interfaces live in Application layer
Define interfaces in:
- `apps/api/src/application/ports/`

Examples:
- `ClientRepository`
- `QuoteRepository`
- `InvoiceRepository`
- `OutboxRepository`
- `SecureLinkTokenRepository`

Rules:
- Ports use **domain/application types**, not DB row types.
- Ports accept `tenantId` as a first-class parameter for tenant-owned entities.

### 2.2 Infra implementations live in Infrastructure layer
Implement interfaces in:
- `apps/api/src/infra/db/repositories/`

Infra may use SQL/ORM and maps to/from domain/application types.

---

## 3) Method signature conventions (tenantId first)

For tenant-owned repositories, prefer signatures like:

- `getById(tenantId, id)`
- `list(tenantId, filters)`
- `create(tenantId, input)`
- `update(tenantId, id, patch)`
- `delete(tenantId, id)`

This prevents “forgot tenant filter” bugs.

For non-tenant global tables (rare; try to avoid in MVP), do not accept tenantId.

---

## 4) Database schema conventions

### 4.1 Common columns
Tenant-owned tables:
- `id` (uuid)
- `tenant_id` (uuid, fk)
- `created_at`, `updated_at`

Optional but common:
- `public_id` (tenant-scoped public identifier)
- `status` (enum/text)
- `deleted_at` (if soft delete)

### 4.2 Foreign keys
- All tenant-owned entities referencing other tenant-owned entities must reference by id and share the same tenant.
- Either enforce via:
  - application invariant checks, and/or
  - composite keys / additional constraints (advanced; optional for MVP)

### 4.3 Uniqueness constraints (per-tenant)
Allowed:
- `UNIQUE(tenant_id, public_id)`
- `UNIQUE(tenant_id, name)` (only if business rules require)
Avoid:
- `UNIQUE(email)` globally for external customers (clients)

---

## 5) Index strategy (MVP performance + correctness)

Every list endpoint should have indexes that include `tenant_id` first.

Common patterns:
- `(tenant_id, created_at desc)`
- `(tenant_id, status, created_at desc)`
- `(tenant_id, client_id, created_at desc)` for timelines

Search:
- If doing basic search by name/email/phone:
  - consider `(tenant_id, lower(name))` (or functional index)
  - avoid global search indexes without tenant_id

---

## 6) Secure links data model (token storage)

Use a table like `secure_link_tokens`:
- `tenant_id`
- `token_hash` (unique)
- `hash_version`
- `subject_type`, `subject_id`
- `scopes`
- `expires_at`, `revoked_at`
- `created_at`, `last_used_at`

Rules:
- Never store plaintext token.
- Token lookup is via hashing incoming token and matching `token_hash`.

---

## 7) Outbox data model (durable comms)

`message_outbox` should include:
- `tenant_id`
- `type` (sms/email)
- `status` (queued/scheduled/sent/failed)
- `provider`
- `attempt_count`
- `correlation_id`
- timestamps: `created_at`, `sent_at`
- `last_error_code`, `last_error_message` (redacted)

Worker idempotency rule:
- If outbox row is already `sent` (or has `sent_at`), do not send again.

---

## 8) S3 keying rules (tenant isolation)

All S3 objects must be under tenant prefix.

Recommended key format:
- `tenants/<tenantId>/<resource>/<resourceId>/<type>/<uuid>.<ext>`

Examples:
- `tenants/<tenantId>/visits/<visitId>/photos/<uuid>.jpg`

Rules:
- Never accept an arbitrary key from the client.
- Server generates keys; presigned URL must be scoped to that key.

---

## 9) Transaction boundaries (MVP guidance)

Use DB transactions when:
- creating linked objects in one action (e.g., request→client→property→quote draft)
- writing outbox + domain state transitions that must be atomic

Do NOT wrap external calls (SMS/SES/Stripe) inside DB transactions:
- write outbox first, commit, then async worker sends.

---

## 10) Multi-tenant enforcement strategies (pick at least one)

### 10.1 Application-enforced tenancy (required)
- Every repository method requires tenantId.
- All queries include tenant filter.

### 10.2 DB-level enforcement (optional MVP hardening)
Possible later:
- Postgres Row Level Security (RLS)
- Separate schemas per tenant (not recommended early)
- Separate DB per tenant (not MVP)

For MVP: rely on application-enforced tenancy + tests.

---

## 11) Required tests for tenancy enforcement (must exist)

For each tenant-owned entity:
- create under Tenant A
- attempt read/update/delete under Tenant B context
- expect 404/403 and no data leakage

For secure links:
- token from Tenant A cannot access Tenant B objects
- token scope mismatch denies actions

---

## 12) Common pitfalls & how this doc prevents them

- **Forgot tenant filter** → tenantId required in repo method signature
- **Leaky list endpoints** → indexes + tenant-first query patterns + tests
- **Token not tenant-bound** → token table stores tenant_id and subject binding
- **S3 path traversal** → server-generated keys only
- **Duplicate sends** → outbox is truth + idempotent worker rules
