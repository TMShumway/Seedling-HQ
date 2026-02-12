# Seedling-HQ — Domain Model, Status Machines, and Audit Event Catalog

_Last updated: 2026-02-12 (America/Chihuahua)_

> Purpose: Canonical reference for all domain entities, their fields, status machines, relationships, and audit events.
> This is the single source of truth for entity shapes — use cases and repositories must conform to these definitions.

---

## 1) Entity overview

### 1.1 Implemented entities (S-0001 through S-0012, plus S-0026–S-0031)

| Entity | Story | Tenant-scoped | Singleton | Soft delete |
|--------|-------|---------------|-----------|-------------|
| Tenant | S-0001 | N/A (is the tenant) | No | No |
| User | S-0001 | Yes | No | No |
| BusinessSettings | S-0002 | Yes | Yes (per tenant) | No |
| ServiceCategory | S-0003 | Yes | No | Yes (`active` flag) |
| ServiceItem | S-0003 | Yes | No | Yes (`active` flag) |
| Client | S-0004 | Yes | No | Yes (`active` flag) |
| Property | S-0004 | Yes | No | Yes (`active` flag) |
| AuditEvent | S-0001 | Yes | No | No (append-only) |
| Request | S-0006 | Yes | No | No |
| MessageOutbox | S-0007 | Yes | No | No (append-only) |
| Quote | S-0008 | Yes | No | No |
| SecureLinkToken | S-0010 | Yes | No | No |
| Job | S-0012 | Yes | No | No |
| Visit | S-0012 | Yes | No | No |

### 1.2 Planned entities (future stories)

| Entity | Story | Description |
|--------|-------|-------------|
| Invoice | S-0017 | Bill generated from completed work |
| QuoteFollowUp | S-0023 | Automated follow-up schedule for unapproved quotes (24h/72h cadence) |
| InvoiceReminder | S-0024 | Automated reminder schedule for unpaid invoices (tenant-configurable cadence) |

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
  passwordHash: string | null; // Nullable — cognito-mode users don't store passwords locally
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

### Request

```typescript
type RequestStatus = 'new' | 'reviewed' | 'converted' | 'declined';
type RequestSource = 'public_form' | 'manual';

interface Request {
  id: string;
  tenantId: string;
  source: RequestSource;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  description: string;
  status: RequestStatus;
  assignedUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:** `(tenant_id, created_at)`, `(tenant_id, status)`
**Status machine:**
```
new → reviewed → converted
              → declined
```

- `new`: just submitted (public form or manual)
- `reviewed`: owner has seen and triaged
- `converted`: linked to a Client + Quote draft (S-0008)
- `declined`: owner rejected the request

**Public endpoint:** `POST /v1/public/requests/:tenantSlug` (no auth, rate-limited, honeypot)
**Authenticated endpoints:** `GET /v1/requests` (paginated), `GET /v1/requests/:id`, `GET /v1/requests/count`, `POST /v1/requests/:id/convert` (S-0008)
**Audit events:** `request.created` with `principalType: 'system'`, `principalId: 'public_form'`; `request.converted` with `principalType: 'internal'` (S-0008)

### MessageOutbox

```typescript
type MessageOutboxStatus = 'queued' | 'scheduled' | 'sent' | 'failed';
type MessageChannel = 'email' | 'sms';

interface MessageOutbox {
  id: string;                          // UUID
  tenantId: string;                    // FK → tenants.id
  type: string;                        // e.g., 'request_notification'
  recipientId: string | null;          // FK → users.id (or null)
  recipientType: string | null;        // 'user' | 'client' | null
  channel: MessageChannel;             // 'email' | 'sms'
  subject: string | null;              // email subject (null for SMS)
  body: string;                        // message content (HTML for email, text for SMS)
  status: MessageOutboxStatus;
  provider: string | null;             // 'smtp' | 'ses' | 'sns' etc.
  providerMessageId: string | null;
  attemptCount: number;                // default 0, incremented on each send attempt
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  correlationId: string;
  scheduledFor: Date | null;           // for delayed sends
  createdAt: Date;
  sentAt: Date | null;
}
```

**Indexes:** `(tenant_id, created_at)`, `(status, created_at)`
**Status values:** `queued` (initial), `scheduled` (future send), `sent` (delivered), `failed` (error)
**Email flow (S-0007):** Record created as `queued` → Nodemailer send attempted → updated to `sent` or `failed`. Best-effort, never throws.
**SMS flow (S-0007):** Record created as `queued` only. Actual sending deferred to S-0021 worker.
**Source of truth:** The outbox table is the durable record for all outbound comms.

### Quote

```typescript
type QuoteStatus = 'draft' | 'sent' | 'approved' | 'declined' | 'expired' | 'scheduled';

interface QuoteLineItem {
  serviceItemId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;  // Integer cents
  total: number;      // Integer cents
}

interface Quote {
  id: string;                    // UUID
  tenantId: string;              // FK → tenants.id
  requestId: string | null;      // FK → requests.id (nullable — quotes created later may not have a request)
  clientId: string;              // FK → clients.id
  propertyId: string | null;     // FK → properties.id (nullable — future quotes may not require a property)
  title: string;
  lineItems: QuoteLineItem[];   // JSONB, default []
  subtotal: number;              // Integer cents, default 0
  tax: number;                   // Integer cents, default 0
  total: number;                 // Integer cents, default 0
  status: QuoteStatus;           // default 'draft'
  sentAt: Date | null;
  approvedAt: Date | null;
  declinedAt: Date | null;
  scheduledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:** `(tenant_id)`, `(client_id)`, `(request_id)`, `(tenant_id, status)`
**Status machine:**
```
draft → sent → approved → scheduled
             → declined
             → expired
```

- `draft`: being built, not visible to client (S-0008 creates quotes in this state)
- `sent`: secure link delivered to client (S-0010)
- `approved`: client accepted (S-0011)
- `declined`: client explicitly rejected (S-0011)
- `expired`: token TTL passed without action (S-0010)
- `scheduled`: job created from approved quote (S-0012)

**Creation via conversion (S-0008):** `POST /v1/requests/:id/convert` atomically creates client + property + quote draft + updates request status to `converted`. The quote is created with empty `lineItems`, zero totals, and `draft` status.
**Standalone creation (S-0026):** `POST /v1/quotes` creates a draft quote for an existing client without a request. Validates client (exists, active, same tenant) and optional property (exists, active, belongs to client). Quote starts with empty `lineItems`, zero totals, and `draft` status — line items added via `PUT /v1/quotes/:id`.
**Authenticated endpoints (S-0009/S-0026):** `POST /v1/quotes`, `GET /v1/quotes` (paginated), `GET /v1/quotes/:id`, `PUT /v1/quotes/:id`, `GET /v1/quotes/count`

### Job

```typescript
type JobStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

interface Job {
  id: string;              // UUID
  tenantId: string;        // FK → tenants.id
  quoteId: string;         // FK → quotes.id
  clientId: string;        // FK → clients.id
  propertyId: string | null; // FK → properties.id
  title: string;
  status: JobStatus;
  createdAt: Date;
  updatedAt: Date;
}
```

**Uniqueness:** `(tenantId, quoteId)` — one job per quote (1:1 cardinality)
**Indexes:** `(tenant_id)`, `(tenant_id, status)`, `(client_id)`
**Status machine:**
```
scheduled → in_progress → completed
                       → cancelled
```

- `scheduled`: job created from approved quote (S-0012)
- `in_progress`: at least one visit started (future)
- `completed`: all visits completed (future)
- `cancelled`: job cancelled by owner (future)

**Creation (S-0012):** `POST /v1/jobs` with `{ quoteId }` atomically creates job + first visit + transitions quote to `scheduled` inside UoW. Idempotent: if quote is already `scheduled`, returns existing job. Scoped unique violation catch for race conditions.
**Authenticated endpoints (S-0012):** `POST /v1/jobs`, `GET /v1/jobs` (paginated), `GET /v1/jobs/:id` (with embedded visits), `GET /v1/jobs/count`, `GET /v1/jobs/by-quote/:quoteId`

### Visit

```typescript
type VisitStatus = 'scheduled' | 'en_route' | 'started' | 'completed' | 'cancelled';

interface Visit {
  id: string;              // UUID
  tenantId: string;        // FK → tenants.id
  jobId: string;           // FK → jobs.id
  assignedUserId: string | null; // FK → users.id
  scheduledStart: Date | null;   // timestamp with timezone
  scheduledEnd: Date | null;     // timestamp with timezone
  estimatedDurationMinutes: number;
  status: VisitStatus;
  notes: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:** `(tenant_id)`, `(job_id)`, `(tenant_id, status)`
**Status machine:**
```
scheduled → en_route → started → completed
                              → cancelled
```

- `scheduled`: visit created, awaiting time assignment (S-0012 creates with null scheduledStart/End)
- `en_route`: member heading to site (optional, future)
- `started`: member on-site, work in progress (future)
- `completed`: work done, notes/photos captured (future)
- `cancelled`: visit cancelled (future)

**Duration calculation (S-0012):** Sum of `estimatedDurationMinutes` from quote line items' service items; defaults to 60 if sum is 0 or all items have null duration.
**Embedded response:** Visits are returned as an array within `GET /v1/jobs/:id` and `GET /v1/jobs/by-quote/:quoteId` (no separate visit endpoints).

---

## 3) Planned entity definitions and status machines

> These definitions are **draft specifications** for upcoming stories. Finalize during story planning.

### Invoice (S-0017)

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

### SecureLinkToken (S-0010)

```
SecureLinkToken {
  id, tenantId, tokenHash, hashVersion,
  subjectType, subjectId, scopes,
  expiresAt, revokedAt,
  createdByUserId, createdAt, lastUsedAt
}
```

**Notes:** Never store plaintext tokens. Lookup by hashing the presented token and matching `tokenHash`.

### QuoteFollowUp (S-0023)

```
QuoteFollowUp {
  id, tenantId, quoteId,
  cadenceSteps (JSONB — e.g., [24h, 72h]),
  currentStep, nextSendAt,
  status, createdAt, canceledAt
}
```

**Status values:** `active`, `completed` (all steps sent), `canceled` (quote approved/declined)
**Cancellation:** On `quote.approved` or `quote.declined`, cancel pending follow-ups.
**Infra:** EventBridge Scheduler → SQS → Worker Lambda

### InvoiceReminder (S-0024)

```
InvoiceReminder {
  id, tenantId, invoiceId,
  cadenceConfig (tenant-configurable),
  nextSendAt, status,
  createdAt, canceledAt
}
```

**Status values:** `active`, `completed`, `canceled` (invoice paid)
**Cancellation:** On `invoice.paid`, cancel all pending reminders for that invoice.
**Infra:** EventBridge Scheduler → SQS → Worker Lambda

### S-0025 — Public form abuse protection

No new entity. Enhances existing public request form with:
- Server-side rate limiting per IP (Dynamo/Redis in prod; in-memory locally — partially implemented in S-0006)
- Honeypot field (implemented in S-0006)
- Logging of rejected attempts
- AWS: API Gateway throttles (prod), WAF (future)

---

## 4) Entity relationships

```
Tenant
  ├── 1:1  BusinessSettings
  ├── 1:*  User
  ├── 1:*  ServiceCategory
  │         └── 1:*  ServiceItem
  ├── 1:*  Client (S-0004)
  │         └── 1:*  Property (S-0004)
  ├── 1:*  Request (S-0006)
  ├── 1:*  Quote (S-0008)
  │         └── 1:1  Job (S-0012)
  │                   └── 1:*  Visit (S-0012)
  ├── 1:*  Invoice (S-0017)
  ├── 1:*  MessageOutbox (S-0007)
  ├── 1:*  SecureLinkToken (S-0010)
  ├── 1:*  AuditEvent (append-only)
  │
  Quote ──1:*── QuoteFollowUp (S-0023)
  Invoice ──1:*── InvoiceReminder (S-0024)
```

---

## 5) Audit event catalog

### Implemented events (S-0001 through S-0012, plus S-0026–S-0031)

| Event name | Subject type | Fires when | Story |
|------------|-------------|------------|-------|
| `tenant.created` | tenant | New tenant signed up | S-0001 |
| `auth.signup` | user | Owner user created during signup | S-0001 |
| `business_settings.created` | business_settings | Settings upserted for first time (createdAt ≈ updatedAt) | S-0002 |
| `business_settings.updated` | business_settings | Settings subsequently updated (updatedAt > createdAt) | S-0002 |
| `service_category.created` | service_category | New category added | S-0003 |
| `service_category.updated` | service_category | Category name/description/sortOrder changed | S-0003 |
| `service_category.deactivated` | service_category | Category soft-deleted | S-0003 |
| `service_item.created` | service_item | New service item added | S-0003 |
| `service_item.updated` | service_item | Service item fields changed | S-0003 |
| `service_item.deactivated` | service_item | Service item soft-deleted | S-0003 |
| `client.created` | client | New client record created | S-0004 |
| `client.updated` | client | Client fields changed | S-0004 |
| `client.deactivated` | client | Client soft-deleted (cascades to properties) | S-0004 |
| `property.created` | property | New property added to client | S-0004 |
| `property.updated` | property | Property fields changed | S-0004 |
| `property.deactivated` | property | Property soft-deleted | S-0004 |
| `request.created` | request | New request submitted (public form) | S-0006 |
| `request.converted` | request | Request converted to client + quote draft | S-0008 |
| `quote.created` | quote | Quote draft created (via conversion or manually) | S-0008 |
| `quote.updated` | quote | Quote fields changed | S-0009 |
| `quote.sent` | quote | Secure link sent to client | S-0010 |
| `quote.viewed` | quote | Client opens secure link | S-0010 |
| `quote.approved` | quote | Client approves quote via secure link (`principalType: 'external'`) | S-0011 |
| `quote.declined` | quote | Client declines quote via secure link (`principalType: 'external'`) | S-0011 |
| `user.created` | user | User created by owner/admin | S-0031 |
| `user.reprovisioned` | user | Disabled user re-enabled and re-provisioned | S-0031 |
| `user.password_reset` | user | Password reset triggered by admin | S-0031 |
| `user.password_changed` | user | User changed own password | S-0031 |
| `job.created` | job | Job created from approved quote | S-0012 |
| `visit.scheduled` | visit | First visit created with job | S-0012 |
| `quote.scheduled` | quote | Quote transitioned to scheduled (job created) | S-0012 |

> **Note (S-0007):** New request notifications are tracked via `message_outbox` records (not audit events). The `message.sent` audit event is planned for S-0021 when the SMS worker is implemented.

### Planned events (future stories)

| Event name | Subject type | Fires when | Story |
|------------|-------------|------------|-------|
| `visit.rescheduled` | visit | Visit date/time changed | S-0013 |
| `visit.completed` | visit | Tech marks visit done | S-0015/S-0016 |
| `invoice.created` | invoice | Invoice generated from visit | S-0017 |
| `invoice.sent` | invoice | Secure link sent to client | S-0017 |
| `invoice.viewed` | invoice | Client opens secure link | S-0017 |
| `invoice.paid` | invoice | Payment received via Stripe | S-0018 |
| `message.sent` | message_outbox | Email/SMS sent by worker | S-0021 |
| `hub.viewed` | client_hub | Client opens hub link | S-0020 |
| `reminder.scheduled` | reminder | Reminder scheduled via EventBridge | S-0022 |
| `reminder.sent` | reminder | Reminder delivered | S-0022 |
| `reminder.canceled` | reminder | Reminder canceled (state change) | S-0022 |
| `quote.follow_up.sent` | quote | Automated quote follow-up sent (24h/72h) | S-0023 |
| `quote.follow_up.canceled` | quote | Quote follow-up canceled (approved/declined) | S-0023 |
| `invoice.reminder.sent` | invoice | Automated invoice payment reminder sent | S-0024 |
| `invoice.reminder.canceled` | invoice | Invoice reminder canceled (paid) | S-0024 |

### Audit event schema

All audit events share this structure:

```typescript
{
  id: string;                // UUID
  tenantId: string;          // FK → tenants.id
  principalType: string;     // 'internal' | 'system' | 'external'
  principalId: string;       // user_id or token_id
  eventName: string;         // e.g., 'quote.approved'
  subjectType: string;       // e.g., 'quote'
  subjectId: string;         // UUID of the affected entity
  correlationId: string;
  createdAt: Date;           // append-only, never updated
}
```

---

## 6) Source-of-truth rules

| Data | Source of truth | Notes |
|------|----------------|-------|
| Entity state | Primary tables (`tenants`, `users`, etc.) | Always scoped by `tenant_id` |
| Audit trail | `audit_events` table | Append-only; never updated or deleted |
| Outbound comms | `message_outbox` table (S-0007) | Durable record; email sent immediately (best-effort), SMS queued for S-0021 worker |
| External access | `secure_link_tokens` table (S-0010) | Token hash only; never store plaintext |
| Scheduled reminders | EventBridge Scheduler (S-0022) | Deterministic schedule keys for reliable cancellation |
| Quote follow-ups | `quote_follow_ups` table + EventBridge (S-0023) | Auto-canceled on approve/decline |
| Invoice reminders | `invoice_reminders` table + EventBridge (S-0024) | Auto-canceled on payment |

---

## 7) Conventions

- **All IDs are UUIDs** (v4, generated server-side)
- **All timestamps are `Date` objects** in domain, ISO 8601 strings in API responses
- **Prices are integer cents** in domain and DB; dollars only in the UI layer
- **Soft delete uses `active` boolean**, not `deleted_at` timestamps
- **Status transitions are enforced in domain/use case layer**, not in DB constraints
- **Entity interfaces live in `apps/api/src/domain/entities/`**
- **Type enums live in `apps/api/src/domain/types/`**

---

## 8) Full story backlog (GitHub source of truth)

### Implemented (merged to main)

| Story | Title | Area | Epic |
|-------|-------|------|------|
| S-0001 | Business signup + first tenant | platform | E-0001 |
| S-0002 | Onboarding wizard (business profile) | platform | E-0001 |
| S-0003 | Service catalog (price book v1) | platform | E-0001 |
| S-0004 | Client + property creation | crm | E-0002 |
| S-0005 | Client timeline (activity feed v1) | crm | E-0002 |
| S-0006 | Public "Request Service" form | intake | E-0003 |
| S-0007 | New request notifications (Email + outbound SMS) | intake | E-0003 |
| S-0008 | Convert request to client + quote draft | intake | E-0003 |
| S-0009 | Quote builder v1 | quotes | E-0004 |
| S-0010 | Send quote link to customer (secure link) | quotes | E-0004 |
| S-0011 | Customer approves quote | quotes | E-0004 |
| S-0026 | Create standalone quote | quotes | E-0004 |
| S-0027 | Local login/logout page | platform | E-0001 |
| S-0028 | Cognito User Pool infrastructure (CDK) | platform | E-0001 |
| S-0029 | Cognito JWT validation | platform | E-0001 |
| S-0030 | Frontend Cognito SDK integration | platform | E-0001 |
| S-0031 | Cognito user provisioning + team management | platform | E-0001 |
| S-0012 | Create job + first visit from approved quote | scheduling | E-0005 |

### Planned (MVP — Release R1)

| Story | Title | Area | Epic | Priority |
|-------|-------|------|------|----------|
| S-0013 | Calendar view (week/day) + schedule/reschedule | scheduling | E-0005 | P0 |
| S-0014 | Assign technician to visit | scheduling | E-0005 | P0 |
| S-0015 | Tech "Today" view (mobile web) | field | E-0006 | P0 |
| S-0016 | Job completion with notes + photos | field | E-0006 | P0 |
| S-0017 | Generate invoice from completed visit | billing | E-0007 | P0 |
| S-0018 | Customer pays invoice online (Stripe) | billing | E-0007 | P0 |
| S-0019 | Basic AR dashboard | billing | E-0007 | P1 |
| S-0020 | Client Hub (loginless secure link) | portal | E-0008 | P0 |
| S-0021 | Outbound comms outbox + worker (email+SMS) | comms | E-0009 | P0 |
| S-0022 | Appointment reminders (Scheduler → SQS → worker) | automation | E-0010 | P0 |
| S-0023 | Quote follow-up automation | automation | E-0010 | P1 |
| S-0024 | Invoice reminder automation | automation | E-0010 | P1 |
| S-0025 | Public form abuse protection (MVP) | security | E-0011 | P1 |

### Post-MVP

| Story | Title | Notes |
|-------|-------|-------|
| S-0032 | In-app notification center | Revisit when 3+ notification types exist |
