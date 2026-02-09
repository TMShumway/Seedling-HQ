# Seedling-HQ — Domain Model, Status Machines, and Audit Event Catalog

_Last updated: 2026-02-09 (America/Chihuahua)_

> Purpose: Canonical reference for all domain entities, their fields, status machines, relationships, and audit events.
> This is the single source of truth for entity shapes — use cases and repositories must conform to these definitions.

---

## 1) Entity overview

### 1.1 Implemented entities (S-001 through S-004)

| Entity | Story | Tenant-scoped | Singleton | Soft delete |
|--------|-------|---------------|-----------|-------------|
| Tenant | S-001 | N/A (is the tenant) | No | No |
| User | S-001 | Yes | No | No |
| BusinessSettings | S-002 | Yes | Yes (per tenant) | No |
| ServiceCategory | S-003 | Yes | No | Yes (`active` flag) |
| ServiceItem | S-003 | Yes | No | Yes (`active` flag) |
| Client | S-004 | Yes | No | Yes (`active` flag) |
| Property | S-004 | Yes | No | Yes (`active` flag) |
| AuditEvent | S-001 | Yes | No | No (append-only) |

### 1.2 Planned entities (future stories)

| Entity | Story | Description |
|--------|-------|-------------|
| Request | S-006 | Lead intake from public form or manual entry |
| Quote | S-009 | Priced proposal sent to client for approval |
| Job | S-012 | Work order created from an approved quote |
| Visit | S-012 | Individual scheduled service visit within a job |
| Invoice | S-017 | Bill generated from completed work |
| MessageOutbox | S-021 | Durable record for outbound SMS/email |
| SecureLinkToken | S-010 | Loginless access token for external pages |

---

## 2) Implemented entity definitions

### Tenant

```typescript
interface Tenant {
  id: string;           // UUID
  slug: string;         // URL-safe, unique globally
  name: string;         // Business display name
  status: TenantStatus; // 'active' | 'suspended'
  createdAt: Date;
  updatedAt: Date;
}
```

**Uniqueness:** `slug` is globally unique.
**Status values:** `active`, `suspended`
**Notes:** Root aggregate. All other data is scoped by `tenant_id`. The `slug` is generated from `name` via `slugify()` and validated to be non-empty.

### User

```typescript
interface User {
  id: string;           // UUID
  tenantId: string;     // FK → tenants.id
  email: string;
  fullName: string;
  role: Role;           // 'owner' | 'admin' | 'member'
  status: UserStatus;   // 'active' | 'disabled'
  createdAt: Date;
  updatedAt: Date;
}
```

**Uniqueness:** `(tenantId, email)` — same email can exist in different tenants.
**Role values:** `owner`, `admin`, `member`
**Status values:** `active`, `disabled`

### BusinessSettings

```typescript
interface BusinessSettings {
  id: string;                          // UUID
  tenantId: string;                    // FK → tenants.id, UNIQUE
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  timezone: string | null;            // IANA timezone string
  businessHours: BusinessHours | null; // JSONB — per-day open/close/closed
  serviceArea: string | null;
  defaultDurationMinutes: number | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface BusinessHours {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

interface DaySchedule {
  open: string | null;   // HH:MM format
  close: string | null;  // HH:MM format
  closed: boolean;
}
```

**Uniqueness:** `tenantId` is unique — exactly one settings record per tenant.
**Pattern:** Singleton upsert via `onConflictDoUpdate` on the `tenant_id` unique constraint.
**Notes:** All fields are nullable. GET returns `null` (200) when not yet configured.

### ServiceCategory

```typescript
interface ServiceCategory {
  id: string;              // UUID
  tenantId: string;        // FK → tenants.id
  name: string;
  description: string | null;
  sortOrder: number;       // default 0
  active: boolean;         // soft delete flag
  createdAt: Date;
  updatedAt: Date;
}
```

**Uniqueness:** `(tenantId, name)`
**Soft delete:** Setting `active = false` also cascades to all child ServiceItems via `deactivateByCategoryId`.

### ServiceItem

```typescript
interface ServiceItem {
  id: string;                          // UUID
  tenantId: string;                    // FK → tenants.id
  categoryId: string;                  // FK → service_categories.id
  name: string;
  description: string | null;
  unitPrice: number;                   // Integer cents (e.g., 4500 = $45.00)
  unitType: UnitType;                  // 'flat' | 'hourly' | 'per_sqft' | 'per_unit' | 'per_visit'
  estimatedDurationMinutes: number | null;
  active: boolean;                     // soft delete flag
  sortOrder: number;                   // default 0
  createdAt: Date;
  updatedAt: Date;
}
```

**Uniqueness:** `(tenantId, categoryId, name)`
**Unit type values:** `flat`, `hourly`, `per_sqft`, `per_unit`, `per_visit`
**Price convention:** Stored as integer cents in DB, displayed as dollars in UI.

### Client

```typescript
interface Client {
  id: string;              // UUID
  tenantId: string;        // FK → tenants.id
  firstName: string;
  lastName: string;
  email: string | null;    // nullable (phone-only clients OK)
  phone: string | null;
  company: string | null;
  notes: string | null;
  tags: string[];          // JSONB array
  active: boolean;         // soft delete flag
  createdAt: Date;
  updatedAt: Date;
}
```

**Uniqueness:** `(tenantId, email)` — nulls are distinct in Postgres, so phone-only clients are fine.
**Soft delete:** Setting `active = false` also cascades to all child Properties via `deactivateByClientId`.
**Pagination:** Cursor-based keyset on `(created_at DESC, id DESC)` with base64url-encoded JSON cursor.
**Search:** ILIKE across firstName, lastName, email, phone, company.

### Property

```typescript
interface Property {
  id: string;              // UUID
  tenantId: string;        // FK → tenants.id
  clientId: string;        // FK → clients.id
  addressLine1: string;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
  active: boolean;         // soft delete flag
  createdAt: Date;
  updatedAt: Date;
}
```

**Uniqueness:** `(tenantId, clientId, addressLine1)`
**URL pattern:** Listed at `/v1/clients/:clientId/properties` (nested), operated at `/v1/properties/:id` (flat).

---

## 3) Planned entity definitions and status machines

> These definitions are **draft specifications** for upcoming stories. Finalize during story planning.

### Request (S-006)

```
Request {
  id, tenantId, source, clientName, clientEmail, clientPhone,
  description, status, assignedUserId, createdAt, updatedAt
}
```

**Status machine:**
```
new → reviewed → converted
              → declined
```

- `new`: just submitted (public form or manual)
- `reviewed`: owner has seen and triaged
- `converted`: linked to a Client + Quote draft (S-008)
- `declined`: owner rejected the request

### Quote (S-009)

```
Quote {
  id, tenantId, clientId, propertyId, title,
  lineItems (JSONB), subtotal, tax, total,
  status, sentAt, approvedAt, declinedAt,
  createdAt, updatedAt
}
```

**Status machine:**
```
draft → sent → approved
            → declined
            → expired
```

- `draft`: being built, not visible to client
- `sent`: secure link delivered to client
- `approved`: client accepted (captures name + timestamp)
- `declined`: client explicitly rejected
- `expired`: token TTL passed without action

### Job (S-012)

```
Job {
  id, tenantId, quoteId, clientId, propertyId,
  title, status, createdAt, updatedAt
}
```

**Status machine:**
```
scheduled → in_progress → completed
                       → cancelled
```

- `scheduled`: job created from approved quote
- `in_progress`: at least one visit started
- `completed`: all visits completed
- `cancelled`: job cancelled by owner

### Visit (S-012)

```
Visit {
  id, tenantId, jobId, assignedUserId,
  scheduledDate, scheduledStartTime, scheduledEndTime,
  status, notes, completedAt, createdAt, updatedAt
}
```

**Status machine:**
```
scheduled → en_route → started → completed
                              → cancelled
```

- `scheduled`: visit created with date/time
- `en_route`: technician heading to site (optional)
- `started`: technician on-site, work in progress
- `completed`: work done, notes/photos captured
- `cancelled`: visit cancelled

### Invoice (S-017)

```
Invoice {
  id, tenantId, jobId, clientId,
  lineItems (JSONB), subtotal, tax, total,
  status, dueDate, sentAt, paidAt,
  createdAt, updatedAt
}
```

**Status machine:**
```
draft → sent → paid
            → overdue
            → void
```

- `draft`: generated from completed visit
- `sent`: secure link delivered to client
- `paid`: payment received (Stripe webhook)
- `overdue`: past due date without payment
- `void`: cancelled by owner

### MessageOutbox (S-021)

```
MessageOutbox {
  id, tenantId, type, recipientId, recipientType,
  channel, subject, body, status,
  provider, providerMessageId,
  attemptCount, lastErrorCode, lastErrorMessage,
  correlationId, scheduledFor,
  createdAt, sentAt
}
```

**Status values:** `queued`, `scheduled`, `sent`, `failed`
**Source of truth:** The outbox table is the durable record for all outbound comms.

### SecureLinkToken (S-010)

```
SecureLinkToken {
  id, tenantId, tokenHash, hashVersion,
  subjectType, subjectId, scopes,
  expiresAt, revokedAt,
  createdByUserId, createdAt, lastUsedAt
}
```

**Notes:** Never store plaintext tokens. Lookup by hashing the presented token and matching `tokenHash`.

---

## 4) Entity relationships

```
Tenant
  ├── 1:1  BusinessSettings
  ├── 1:*  User
  ├── 1:*  ServiceCategory
  │         └── 1:*  ServiceItem
  ├── 1:*  Client (S-004)
  │         └── 1:*  Property (S-004)
  ├── 1:*  Request (S-006)
  ├── 1:*  Quote (S-009)
  │         └── 1:1  Job (S-012)
  │                   └── 1:*  Visit (S-012)
  ├── 1:*  Invoice (S-017)
  ├── 1:*  MessageOutbox (S-021)
  ├── 1:*  SecureLinkToken (S-010)
  └── 1:*  AuditEvent (append-only)
```

---

## 5) Audit event catalog

### Implemented events (S-001 through S-004)

| Event name | Subject type | Fires when | Story |
|------------|-------------|------------|-------|
| `tenant.created` | tenant | New tenant signed up | S-001 |
| `auth.signup` | user | Owner user created during signup | S-001 |
| `business_settings.created` | business_settings | Settings upserted for first time (createdAt ≈ updatedAt) | S-002 |
| `business_settings.updated` | business_settings | Settings subsequently updated (updatedAt > createdAt) | S-002 |
| `service_category.created` | service_category | New category added | S-003 |
| `service_category.updated` | service_category | Category name/description/sortOrder changed | S-003 |
| `service_category.deactivated` | service_category | Category soft-deleted | S-003 |
| `service_item.created` | service_item | New service item added | S-003 |
| `service_item.updated` | service_item | Service item fields changed | S-003 |
| `service_item.deactivated` | service_item | Service item soft-deleted | S-003 |
| `client.created` | client | New client record created | S-004 |
| `client.updated` | client | Client fields changed | S-004 |
| `client.deactivated` | client | Client soft-deleted (cascades to properties) | S-004 |
| `property.created` | property | New property added to client | S-004 |
| `property.updated` | property | Property fields changed | S-004 |
| `property.deactivated` | property | Property soft-deleted | S-004 |

### Planned events (future stories)

| Event name | Subject type | Fires when | Story |
|------------|-------------|------------|-------|
| `request.created` | request | New request submitted | S-006 |
| `request.converted` | request | Request converted to quote | S-008 |
| `quote.created` | quote | Quote draft created | S-009 |
| `quote.sent` | quote | Secure link sent to client | S-010 |
| `quote.viewed` | quote | Client opens secure link | S-010 |
| `quote.approved` | quote | Client approves quote | S-011 |
| `quote.declined` | quote | Client declines quote | S-011 |
| `job.created` | job | Job created from approved quote | S-012 |
| `visit.scheduled` | visit | Visit date/time assigned | S-012 |
| `visit.rescheduled` | visit | Visit date/time changed | S-013 |
| `visit.completed` | visit | Tech marks visit done | S-015/S-016 |
| `invoice.created` | invoice | Invoice generated from visit | S-017 |
| `invoice.sent` | invoice | Secure link sent to client | S-017 |
| `invoice.viewed` | invoice | Client opens secure link | S-017 |
| `invoice.paid` | invoice | Payment received via Stripe | S-018 |
| `message.sent` | message_outbox | Email/SMS sent by worker | S-021 |
| `hub.viewed` | client_hub | Client opens hub link | S-020 |
| `reminder.scheduled` | reminder | Reminder scheduled via EventBridge | S-022 |
| `reminder.sent` | reminder | Reminder delivered | S-022 |
| `reminder.canceled` | reminder | Reminder canceled (state change) | S-022 |

### Audit event schema

All audit events share this structure:

```typescript
{
  id: string;                // UUID
  tenantId: string;          // FK → tenants.id
  principalType: string;     // 'internal_user' | 'external_token' | 'system'
  principalId: string;       // user_id or token_id
  eventName: string;         // e.g., 'quote.approved'
  subjectType: string;       // e.g., 'quote'
  subjectId: string;         // UUID of the affected entity
  correlationId: string | null;
  createdAt: Date;           // append-only, never updated
}
```

---

## 6) Source-of-truth rules

| Data | Source of truth | Notes |
|------|----------------|-------|
| Entity state | Primary tables (`tenants`, `users`, etc.) | Always scoped by `tenant_id` |
| Audit trail | `audit_events` table | Append-only; never updated or deleted |
| Outbound comms | `message_outbox` table (S-021) | Durable record; worker is idempotent based on outbox status |
| External access | `secure_link_tokens` table (S-010) | Token hash only; never store plaintext |
| Scheduled reminders | EventBridge Scheduler (S-022) | Deterministic schedule keys for reliable cancellation |

---

## 7) Conventions

- **All IDs are UUIDs** (v4, generated server-side)
- **All timestamps are `Date` objects** in domain, ISO 8601 strings in API responses
- **Prices are integer cents** in domain and DB; dollars only in the UI layer
- **Soft delete uses `active` boolean**, not `deleted_at` timestamps
- **Status transitions are enforced in domain/use case layer**, not in DB constraints
- **Entity interfaces live in `apps/api/src/domain/entities/`**
- **Type enums live in `apps/api/src/domain/types/`**
