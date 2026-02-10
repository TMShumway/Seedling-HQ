# Seedling-HQ — Data Access + Tenancy Enforcement (Clean Architecture Ports) for AI-Driven Development

_Last updated: 2026-02-09 (America/Chihuahua)_

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

Examples (implemented):
- `BusinessSettingsRepository` (singleton per tenant — `getByTenantId`, `upsert`)
- `ServiceCategoryRepository`, `ServiceItemRepository`
- `ClientRepository`, `PropertyRepository`
- `RequestRepository` (includes `updateStatus(tenantId, id, status, expectedStatuses?)` with optional race guard via `WHERE status IN (...)`, S-0008)
- `QuoteRepository` (S-0008/S-0009/S-0011 — `create`, `getById`, `list`, `update`, `count`, `countByStatus`, `updateStatus(tenantId, id, status, statusFields?, expectedStatuses?)` with optional race guard via `WHERE status IN (...)` for idempotent external actions)
- `MessageOutboxRepository` (S-0007 — `create`, `updateStatus`)
- `UserRepository` (includes `getOwnerByTenantId` for notification recipient lookup)
- `EmailSender` (port for SMTP — implemented by `NodemailerEmailSender`)

Examples (planned):
- `InvoiceRepository`

Implemented (S-0010):
- `SecureLinkTokenRepository` (`create`, `getByTokenHash`, `updateLastUsedAt`, `revokeBySubject`)

Rules:
- Ports use **domain/application types**, not DB row types.
- Ports accept `tenantId` as a first-class parameter for tenant-owned entities.
- For **singleton-per-tenant entities** (e.g., settings): use `getByTenantId(tenantId)` and `upsert(settings)` — no `list()` needed.

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
- `UNIQUE(tenant_id)` for singleton-per-tenant entities (e.g., `business_settings`)
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

## 6) Secure links data model (token storage) — Implemented in S-0010/S-0011

`secure_link_tokens` columns:
- `tenant_id`
- `token_hash` (unique)
- `hash_version`
- `subject_type`, `subject_id`
- `scopes`
- `expires_at`, `revoked_at`
- `created_at`, `last_used_at`

Indexes: unique index on `token_hash`, composite index on `(tenant_id, subject_type, subject_id)`.

Scope values: `'quote:read'` (view quote), `'quote:respond'` (approve/decline). A single token can have multiple scopes (e.g., `['quote:read', 'quote:respond']` on quote send). External route middleware validates the incoming request's required scope matches one of the token's scopes.

`externalAuthContext` (S-0010): Routes decorated with `buildExternalTokenMiddleware` produce an `externalAuthContext` (not `authContext`) containing: `tenantId`, `tokenId`, `scope`, `objectType`, `objectId`.

Rules:
- Never store plaintext token.
- Token lookup is via hashing incoming token and matching `token_hash`.

---

## 7) Outbox data model (durable comms) — Implemented in S-0007

`message_outbox` columns:
- `id` (UUID PK)
- `tenant_id` (FK → tenants)
- `type` (e.g., `request_notification`)
- `recipient_id` (FK → users, nullable), `recipient_type` (`user` | `client`)
- `channel` (`email` | `sms`)
- `subject` (email subject, nullable), `body` (message content)
- `status` (`queued` | `scheduled` | `sent` | `failed`)
- `provider` (e.g., `smtp`), `provider_message_id`
- `attempt_count` (default 0, incremented on each send attempt)
- `last_error_code`, `last_error_message`
- `correlation_id`
- `scheduled_for` (for delayed sends, nullable)
- `created_at`, `sent_at`

Indexes: `(tenant_id, created_at)`, `(status, created_at)`

**Email flow (S-0007):** `queued` → send via Nodemailer → `sent` or `failed` (synchronous, best-effort).
**SMS flow (S-0007):** `queued` only. Worker in S-0021 will process and update to `sent`/`failed`.

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

### 9.1 UnitOfWork pattern (implemented in S-0001)

Atomic writes use a `UnitOfWork` port (`application/ports/unit-of-work.ts`) backed by `DrizzleUnitOfWork` (`infra/db/drizzle-unit-of-work.ts`).

- `UnitOfWork.run(fn)` provides transaction-scoped repo instances to the callback.
- Use cases take `(readRepo, uow)` — reads stay outside the transaction, writes go inside `uow.run()`.
- Drizzle's `PgTransaction extends PgDatabase`, so repos that accept `Database` work with `tx` directly — no casts needed.
- **TransactionRepos (S-0008):** `{ tenantRepo, userRepo, auditRepo, clientRepo, propertyRepo, requestRepo, quoteRepo }` — all available inside `uow.run()` callback.

Example:
```ts
try {
  return await this.uow.run(async ({ tenantRepo, userRepo, auditRepo }) => {
    const tenant = await tenantRepo.create({ ... });
    const user = await userRepo.create({ ... });
    await auditRepo.record({ ... });
    return { tenant, user };
  });
} catch (err) {
  if (isUniqueViolation(err)) {
    throw new ConflictError(`Tenant with slug "${slug}" already exists`);
  }
  throw err;
}
```

**Defensive unique-constraint handling:** Pre-checks (e.g. `getBySlug`) stay outside the transaction as a fast path, but concurrent requests can race past them. Always wrap `uow.run()` in a try/catch that maps SQL state `23505` (unique_violation) to the appropriate domain error (e.g. `ConflictError`). Use the `isUniqueViolation()` helper from `shared/errors.ts`.

### 9.2 Singleton upsert pattern (implemented in S-0002)

For singleton-per-tenant entities (e.g., `business_settings`), use `onConflictDoUpdate` on the unique `tenant_id` constraint to create-or-update in one operation. This avoids the need for UnitOfWork — it's a single entity write with best-effort audit.

```ts
await db.insert(businessSettings).values({ ...data }).onConflictDoUpdate({
  target: businessSettings.tenantId,
  set: { ...data, updatedAt: new Date() },
});
```

Use cases check existing state to determine audit event name (`business_settings.created` vs `business_settings.updated`).

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
