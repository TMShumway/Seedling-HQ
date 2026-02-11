# Seedling-HQ — API Standards: Errors, Pagination, Idempotency, and Response Conventions

_Last updated: 2026-02-09 (America/Chihuahua)_

> Purpose: Define consistent API behavior so agents and humans build endpoints the same way.
> This doc captures conventions established in S-0001 through S-0029 and defines standards for future stories.

---

## 1) Error response shape

All API errors return a consistent JSON structure:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Service category not found"
  }
}
```

**Implementation:** `apps/api/src/adapters/http/middleware/error-handler.ts`

### Error codes and HTTP status mapping

| HTTP Status | Error Code | Class | When |
|-------------|-----------|-------|------|
| 400 | `VALIDATION_ERROR` | `ValidationError` / Fastify validation | Request body or params fail schema validation, or use-case-level business rule violation (e.g., editing a non-draft quote) |
| 401 | `UNAUTHORIZED` | `UnauthorizedError` | Missing or invalid auth credentials |
| 403 | `LINK_INVALID` | `LinkInvalidError` | External token is invalid, expired, revoked, scope mismatch, subject_type mismatch, or referenced object missing/deleted (S-0010). All cases return the same generic message: "This link is no longer valid." |
| 404 | `NOT_FOUND` | `NotFoundError` | Entity not found within the tenant scope |
| 409 | `CONFLICT` | `ConflictError` | Unique constraint violation (e.g., duplicate slug or name) |
| 429 | `RATE_LIMITED` | _(middleware)_ | Per-IP rate limit exceeded on public endpoints (S-0006) |
| 500 | `INTERNAL_ERROR` | _(unhandled)_ | Unexpected server error; message is always generic |

**Error class hierarchy:** `apps/api/src/shared/errors.ts`

```typescript
AppError (base)
  ├── ValidationError   (400, VALIDATION_ERROR)
  ├── UnauthorizedError (401, UNAUTHORIZED)
  ├── LinkInvalidError  (403, LINK_INVALID)
  ├── NotFoundError     (404, NOT_FOUND)
  └── ConflictError     (409, CONFLICT)
```

### Rules

- Domain/use case layers throw typed `AppError` subclasses — no HTTP concerns
- The error handler maps them to HTTP status codes and the standard error shape
- 500 errors never expose internal details to the client; always return `"Internal server error"`
- 404 is preferred over 403 for cross-tenant access denial to avoid leaking entity existence

---

## 2) Response conventions

### Status codes

| Scenario | Status | Body | Example |
|----------|--------|------|---------|
| Successful read | 200 | Entity or list | `GET /v1/tenants/me` |
| Singleton not yet configured | 200 | `null` | `GET /v1/tenants/me/settings` before setup |
| Successful creation | 201 | Created entity | `POST /v1/tenants` |
| Successful deletion/deactivation | 204 | No body | `DELETE /v1/services/:id` |
| Successful upsert (update) | 200 | Updated entity | `PUT /v1/tenants/me/settings` |
| Standalone entity creation | 201 | Created entity | `POST /v1/quotes` (S-0026) |
| Composite conversion | 200 | Multi-entity result | `POST /v1/requests/:id/convert` (S-0008) |
| Send + create token | 200 | `{ quote, token, link }` | `POST /v1/quotes/:id/send` (S-0010) |
| External token read | 200 | Quote view data | `GET /v1/ext/quotes/:token` (S-0010) |
| External approve/decline | 200 | `{ quote: { id, status, approvedAt, declinedAt } }` | `POST /v1/ext/quotes/:token/approve` / `/decline` (S-0011) |

### Conventions

- **GET returns 200 with `null`** for singleton entities that don't exist yet (not 404). This distinguishes "not configured" from "not found."
- **DELETE returns 204** with no response body. The frontend `request()` function handles 204 by returning `undefined` instead of parsing JSON.
- **PUT is full-replace** for the resource. In practice, some PUT endpoints accept optional fields for partial updates (e.g., `PUT /v1/quotes/:id` — all body fields are optional). Future stories may introduce PATCH for clarity.
- **POST creates a new entity** each time — it is not idempotent.
- **Composite POST** (e.g., `POST /v1/requests/:id/convert`) returns 200 (not 201) since it modifies an existing resource and creates multiple new ones. The status gate (`new`/`reviewed` only) prevents repeated execution. A concurrent double-convert race is guarded by `updateStatus(..., expectedStatuses)` which adds `WHERE status IN (...)` to the SQL UPDATE — if another transaction already converted the request, 0 rows are updated, the transaction rolls back, and a 409 `CONFLICT` is returned.

---

## 3) Authentication and authorization

### Auth context contract

All authenticated requests produce an `AuthContext` with this shape:

```typescript
interface AuthContext {
  tenantId: string;
  userId: string;
  role: string;  // 'owner' | 'admin' | 'member'
}
```

**Implementation:** `packages/shared/src/auth-context.ts`

### Auth modes

| Mode | When | Behavior |
|------|------|----------|
| `AUTH_MODE=local` | Local development | Mock middleware builds authContext from env vars or `X-Dev-Tenant-Id` / `X-Dev-User-Id` request headers |
| `AUTH_MODE=cognito` | Dev sandbox / staging / prod | Validates JWT from `Authorization: Bearer <token>` header using Cognito JWKS |

### Unauthenticated endpoints

These endpoints skip internal auth (`requireAuth`):
- `GET /health`
- `POST /v1/tenants` (signup)
- `POST /v1/auth/local/login` (local dev login, S-0027) — rate-limited (10 req/min), returns 404 when `AUTH_MODE !== 'local'`
- `POST /v1/public/requests/:tenantSlug` (public request form, S-0006) — rate-limited + honeypot
- `GET /v1/ext/quotes/:token` (external quote view, S-0010) — authenticated via secure link token, not Cognito/dev auth
- `POST /v1/ext/quotes/:token/approve` (external quote approve, S-0011) — authenticated via secure link token
- `POST /v1/ext/quotes/:token/decline` (external quote decline, S-0011) — authenticated via secure link token

All other routes require auth via the `requireAuth` preHandler hook.

### External token-authenticated endpoints (S-0010)

Routes under `/v1/ext/*` skip `requireAuth` but use `requireExternalToken` middleware instead. The middleware validates the secure link token (hash match, expiry, revocation, scope) and attaches `tenantId` from the token record. Invalid tokens return 403 `LINK_INVALID` with message "This link is no longer valid."

### Tenant scoping

- Internal routes derive `tenantId` from `authContext` (never from request params)
- Public routes (e.g., `/v1/public/*`) derive `tenantId` from URL param (e.g., `:tenantSlug` → `tenantRepo.getBySlug()`)
- External secure-link routes (`/v1/ext/*`, S-0010) derive `tenantId` from the token record
- Every database query is scoped by `tenantId`

---

## 4) URL and naming conventions

### URL structure

```
/v1/<resource>                    # collection
/v1/<resource>/:id                # single item
/v1/<resource>/:id/<sub-resource> # nested collection
```

### Rules

- **Path segments:** lowercase, kebab-case, plural nouns
- **Examples:** `/v1/services/categories`, `/v1/services`, `/v1/tenants/me/settings`
- **`/me` convention:** used for current-tenant-scoped singletons (`/v1/tenants/me`, `/v1/users/me`, `/v1/tenants/me/settings`)
- **Version prefix:** always `/v1/` (bump only on breaking changes)
- **URL prefix by auth mode:** `/v1/*` for internal authenticated routes, `/v1/public/*` for fully public unauthenticated routes (e.g., public request form), `/v1/ext/*` for external token-authenticated routes (e.g., customer-facing quote view via secure link token, S-0010)
- **Nested read-only aggregate endpoints:** `/v1/<resource>/:id/<view>` for non-CRUD queries scoped to a parent resource (e.g., `/v1/clients/:clientId/timeline` returns paginated audit events for the client and its children). Same cursor pagination as list endpoints; supports query-param filters (e.g., `?exclude=deactivated`). **Index-matching rule:** always include a `subjectType IN (...)` predicate so the composite index `(tenant_id, subject_type, subject_id, created_at)` is fully utilized — omitting it forces Postgres to scan all tenant events before filtering by subject_id.

### JSON field names

- **camelCase** in request and response bodies
- Matches TypeScript interface property names
- Examples: `tenantId`, `unitPrice`, `businessHours`, `createdAt`

### Timestamps

- **ISO 8601 strings** in API responses (e.g., `"2026-02-09T12:00:00.000Z"`)
- **Date objects** in domain layer
- **UTC** for storage and transport; timezone-aware display is a frontend concern

---

## 5) Pagination

> Implemented in S-0004 (Client list). All future list endpoints that need pagination should follow this pattern.

### Cursor-based pagination

```
GET /v1/clients?limit=50&cursor=<opaque_string>
```

**Response shape:**

```json
{
  "data": [...],
  "cursor": "eyJpZCI6Ijk4NzY1...",
  "hasMore": true
}
```

### Implementation details (S-0004)

- **Cursor encoding:** base64url JSON of `{ id, createdAt }` — opaque to clients
- **Keyset condition:** `WHERE (created_at, id) < (cursor_ca, cursor_id) ORDER BY created_at DESC, id DESC`
- **hasMore detection:** Fetch `limit + 1` rows; if extra row exists, `hasMore = true` and trim the result
- **Code location:** `encodeCursor()` / `decodeCursor()` in `drizzle-client-repository.ts`

### Defaults

| Parameter | Default | Max |
|-----------|---------|-----|
| `limit` | 50 | 100 |

### Sorting

- Default sort: `createdAt DESC` (newest first)
- Override via `?sort=name` or `?sort=-createdAt` (prefix `-` for descending)
- Sort fields must be indexed with `tenant_id` prefix

---

## 6) Filtering conventions

### Established patterns (S-0003 through S-0009)

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `includeInactive` | boolean | Include soft-deleted entities | `?includeInactive=true` |
| `categoryId` | UUID | Filter items by category | `?categoryId=abc-123` |
| `search` | string | ILIKE search across multiple columns | `?search=smith` |
| `limit` | number | Page size for cursor pagination | `?limit=25` |
| `cursor` | string | Opaque cursor from previous page | `?cursor=eyJpZCI6...` |
| `status` | string | Filter by status (e.g., requests count) | `?status=new` |

### Future conventions

- Filter params use camelCase: `?clientId=`, `?status=`, `?dateFrom=`, `?dateTo=`
- Multiple values for the same field use comma-separated: `?status=draft,sent`
- Date ranges: `?dateFrom=2026-01-01&dateTo=2026-01-31`

---

## 7) Idempotency

### Current guarantees

| Verb | Idempotent | Notes |
|------|------------|-------|
| GET | Yes | Read-only |
| PUT | Yes | Full-replace semantics; singleton upsert via `onConflictDoUpdate` |
| DELETE | Yes | Soft-delete sets `active = false`; repeated calls are no-ops |
| POST | No | Creates a new entity each time |

### External action idempotency (S-0011)

External routes like `POST /v1/ext/quotes/:token/approve` and `/decline` are idempotent with special semantics:
- **Same action repeated** (e.g., approve then approve again) → 200 with current state; no-op
- **Cross-transition attempt** (e.g., approve then decline) → 400 `VALIDATION_ERROR` ("This quote has already been approved")
- This prevents client double-clicks from causing state thrashing while blocking impossible transitions

### Future: Idempotency-Key header

For POST endpoints with side effects (e.g., invoice payment, SMS send):
- Client sends `Idempotency-Key: <uuid>` header
- Server stores the key and returns the cached response on retry
- Keys expire after 24 hours

This will be implemented when needed (S-0018 Stripe payments, S-0021 outbox).

---

## 8) Request validation

### Schema validation

- All routes define Zod schemas for request body, params, and querystring
- Fastify validates requests automatically via `fastify-type-provider-zod`
- Validation failures return 400 with `VALIDATION_ERROR` code

### Validation rules

- **UUIDs:** validated as `z.string().uuid()` in params
- **Strings:** trimmed, with length constraints where applicable
- **Numbers:** integer constraints for prices (cents), durations (minutes)
- **Enums:** validated against fixed sets (e.g., `unitType` in `['flat', 'hourly', ...]`)
- **Optional fields:** use `z.string().optional()` or `.nullable()`

---

## 9) OpenAPI generation

### Workflow

1. Define Zod schemas in route files
2. Run `pnpm gen` to generate `apps/api/openapi.json` from Fastify routes
3. Use the OpenAPI spec as the contract between API and frontend

### Swagger UI

Available at `http://localhost:4000/docs` in development.

---

## 10) Agent instructions

When adding a new API endpoint:

1. Define Zod schemas for request/response in the route file
2. Use the standard error classes from `shared/errors.ts`
3. Follow the response conventions (200/201/204/null)
4. Scope all queries by `tenantId` from `authContext`
5. Add the endpoint to the README API endpoints table
6. Run `pnpm gen` to update the OpenAPI spec
7. Add integration tests (happy path + validation + cross-tenant denial)
