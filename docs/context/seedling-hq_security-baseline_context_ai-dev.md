# Seedling-HQ — Security Baseline Context Pack (MVP) for AI-Driven Development

_Last updated: 2026-02-11 (America/Chihuahua)_

> Purpose: Paste this into a new LLM/agent so it can build secure features consistently.
> Scope: **MVP baseline security** beyond individual stories, aligned with:
> - AWS-first, local-first development
> - Multi-tenant boundaries (tenant = internal customer/business)
> - External access via **loginless secure links** (tokens)
> - Outbound comms + automation (SQS, Scheduler)
> - Web app is CSR (React + Vite), API is Fastify (Lambda-first)

---

## 1) Non-negotiable security goals

1) **Prevent cross-tenant data leakage**
   - Every request must be scoped to a single tenant (derived from auth context).
2) **Secure external customer access**
   - Loginless links must be tenant-bound + object-bound + scope-bound.
3) **Protect PII and secrets**
   - No tokens/secrets/PII in logs.
   - Clear redaction rules.
4) **Minimize blast radius**
   - Least-privilege IAM.
   - Safe defaults in dev.
5) **Maintain operability**
   - Security controls should not break local dev or MVP velocity.

---

## 2) Threat model summary (MVP)

### 2.1 Primary attacker models
- A malicious user from Tenant B trying to view Tenant A data.
- An external customer receiving/forwarding a secure link (token) to others.
- Automated spam/abuse against public endpoints (request form).
- Bugs that accidentally omit `tenant_id` filters (most common real-world failure).

### 2.2 Highest-risk surfaces
- List/search endpoints (easy to forget tenant filter).
- Secure link endpoints (quote/invoice/hub) if not tenant-bound.
- File upload/download (S3 presigned POST with `content-length-range` + content type conditions, S-0016).
- Worker/SQS processing (idempotency; replay).

---

## 3) Identity, principals, and authorization (MVP)

### 3.1 Tenancy (boundary)
- **Tenant = internal customer (business using Seedling-HQ).**
- External customers (clients/contacts/properties) are tenant-owned records.

### 3.2 Principal types
**A) Internal principals (Seedling users)**
- Authenticated via **AWS Cognito** (JWT-based).
- Auth context derived from Cognito Access token:
  - `tenant_id` (from `custom:tenant_id` claim)
  - `user_id` (from `username` claim — NOT `sub`; contract: Cognito `username` = `users.id`)
  - `role` (from `cognito:groups` claim)
- Local dev uses `AUTH_MODE=local` mock middleware producing the identical auth context shape.

**B) External principals (tenant's customers)**
- Loginless secure links.
- Auth context is derived from a token:
  - `tenant_id`
  - `subject_type` (quote / invoice / client)
  - `subject_id` (object id allowed)
  - `scopes` (quote:read, quote:respond, invoice:pay, hub:read)
  - `expires_at`, `revoked_at`
- **Implemented in S-0010/S-0011:** External auth is handled by the `externalAuthContext` Fastify decorator. It sets `principal_type: 'external'` and `principal_id: token_id` (the DB record ID, not the raw token value). A single token can have multiple scopes (e.g., `['quote:read', 'quote:respond']` on quote send). Each route specifies its required scope; the middleware validates the token includes it.

### 3.3 Authorization rules (must not be mixed)
- Internal authorization: **RBAC within tenant** (“can this role do X?”)
- External authorization: **token scope + object binding** (“can this token do X on this object?”)

Do not shoehorn secure-link checks into internal RBAC logic.

### 3.4 Cognito JWT validation rules (internal auth) — Implemented in S-0029

API middleware validates Cognito Access tokens using `jose` library (`CognitoJwtVerifier` in `infra/auth/cognito-jwt-verifier.ts`):

1. **Signature verification:** Validated via `jose.jwtVerify()` + `createRemoteJWKSet()` (auto-caches JWKS keys, re-fetches on unknown `kid`).
2. **Issuer (`iss`):** Must match `https://cognito-idp.<region>.amazonaws.com/<userPoolId>`.
3. **Token use (`token_use`):** Must be `access` (reject ID tokens on API routes).
4. **Client ID (`client_id`):** Must match the configured App Client ID. **Note:** Cognito access tokens use `client_id`, NOT `aud` — do NOT pass `audience` to `jose.jwtVerify()`.
5. **Expiration (`exp`):** Reject expired tokens. Do not extend or refresh server-side.
6. **Custom claims:**
   - `custom:tenant_id` → `authContext.tenant_id` (added to access token by pre-token-generation V2 Lambda trigger, S-0029)
   - `username` → `authContext.user_id` (NOT `sub` — contract: Cognito `username` must equal `users.id`)
   - `cognito:groups` → `authContext.role` (enforce exactly one group; validate against `ROLES` from `roles.ts`)
7. **UUID format validation:** Both `custom:tenant_id` and `username` must be valid UUIDs (regex check). Rejects non-UUID values at the verifier layer before building `authContext`, preventing DB UUID-cast failures (500) downstream.

**Frontend token lifecycle (implemented in S-0030):**
- **SDK:** `amazon-cognito-identity-js` with `USER_PASSWORD_AUTH` flow (not SRP). Set explicitly via `setAuthenticationFlowType('USER_PASSWORD_AUTH')` on `CognitoUser`.
- **Storage:** Tokens stored in `sessionStorage` via custom `ICognitoStorage` adapter (`cognito-storage.ts`). Survives page refresh, cleared on tab close. Never use `localStorage` (persists too long) or cookies.
- **Refresh (on-demand):** `getAccessToken()` in `AuthProvider` checks token expiry before each API call. If <5 minutes remaining, calls `CognitoAuthClient.refreshSession()` to obtain a new token. No background polling.
- **401 retry:** `api-client.ts` intercepts 401 responses when an auth provider is set. Three distinct failure paths: (1) `forceRefresh()` rejects (e.g., refresh token expired) → `onAuthFailure()` → logout; (2) retry returns 401 (fresh token rejected) → `onAuthFailure()` → logout; (3) retry fetch throws network error → propagate error, NO logout (transient failure, user should retry).
- **Logout:** `CognitoAuthClient.signOut()` + `ICognitoStorage.clear()` (scoped to Cognito-prefixed keys) + `clearAuthProvider()` + `queryClient.clear()`. State-driven: AuthGuard detects `isAuthenticated === false` and redirects to `/login`.
- **NEW_PASSWORD_REQUIRED:** Admin-created users with temporary passwords trigger this Cognito challenge on first login. Frontend shows inline password-change form; `completeNewPasswordChallenge()` forwards `requiredAttributes` opaquely to SDK.
- The API never issues or refreshes tokens — it only validates.

**Revocation considerations (MVP):**
- Cognito Access tokens are short-lived (default 1 hour). For MVP, rely on token expiry.
- If immediate revocation is needed later, implement a token blacklist check or reduce Access token TTL.
- Admin actions like "disable user" in Cognito take effect on the next token validation (after current token expires).

**Local dev (`AUTH_MODE=local`):**
- Skip all JWT validation. Mock middleware produces an `authContext` from env vars (defaults) or `X-Dev-Tenant-Id` / `X-Dev-User-Id` request headers (overrides, set via login page or signup and stored in localStorage).
- Login endpoint (`POST /v1/auth/local/login`, S-0027): cross-tenant email lookup, rate-limited (10 req/min per IP), returns 404 when `AUTH_MODE !== 'local'`. Password verify endpoint (`POST /v1/auth/local/verify`, S-0030): rate-limited (10 req/min per IP), returns 404 when `AUTH_MODE !== 'local'`. Frontend `AuthGuard` redirects unauthenticated users to `/login`.
- This is acceptable only for `NODE_ENV=development`. The mock middleware must refuse to activate if `NODE_ENV=production`.

### 3.5 Internal role-based access control (RBAC) — Implemented in S-0031

Role hierarchy: **Owner > Admin > Member**

| Action | Owner | Admin | Member |
|--------|-------|-------|--------|
| Create user (invite) | Yes (any role) | Yes (member only) | No |
| Reset user password | Yes (admin, member) | Yes (member only) | No |
| Change own password | Yes | Yes | Yes |
| View team list | Yes | Yes | Yes |
| Manage business settings | Yes | Yes | Read-only |

**Implementation:** Role checks are inline in use cases/routes using `if (callerRole !== 'owner') throw new ForbiddenError(...)`. Full declarative RBAC guard system deferred to S-0036.

**Enforcement chain:** Cognito groups (`cognito:groups` claim) → JWT middleware extracts role → `authContext.role` → use case checks. Local dev mock middleware derives role from user record in DB (via auth headers). The `users.role` column has a CHECK constraint enforcing valid values at the DB layer.

---

## 4) Secure link token policy (MVP)

### 4.1 Requirements (non-negotiable)
Every secure link token must be:
- **Tenant-bound**: `tenant_id` embedded in token record
- **Object-bound**: `subject_type + subject_id`
- **Scope-bound**: explicit allowed actions
- **Time-bound**: `expires_at`
- **Revocable**: `revoked_at` support
- **Audited**: record viewed/used (at least `last_used_at`)

### 4.2 Storage rules
- **Never store plaintext tokens.**
- Store `token_hash` only.
- Token lookup is performed by hashing presented token and querying by `token_hash`.

### 4.3 Token hashing strategy (recommended default)
- Generate token bytes using a cryptographically secure RNG.
- Encode token for URLs (base64url or hex; base64url preferred for compactness).
- Hash using:
  - `HMAC-SHA256(secret, token)` **OR**
  - `SHA256(secret || token)` with a versioned secret

**Recommendation:** `HMAC-SHA256` using a server-side secret (e.g., `SECURE_LINK_HMAC_SECRET`).
**Chosen in S-0010:** Implemented as `hashToken()` in `shared/crypto.ts` using HMAC-SHA256 with `SECURE_LINK_HMAC_SECRET`.

### 4.4 Versioning + rotation
- Include a `hash_version` column (e.g., `v1`) so you can rotate the secret later.
- Keep previous secrets for a limited overlap window if needed.

### 4.5 TTL recommendations (MVP defaults)
- Quote token (view + respond): 7–14 days (single token with both `quote:read` and `quote:respond` scopes)
- Invoice pay token: 7–14 days
- Client Hub token: 30–90 days (business decision; include revoke path)

### 4.6 Endpoint enforcement rules (must be implemented)
For any secure-link route:
1) Resolve `authContext` from token.
2) Derive tenant from token **only** (never from request params).
3) Ensure requested object matches token:
   - ID matches `subject_id` OR strict relationship check (e.g., invoice belongs to client in token).
4) Ensure token includes required scope.
5) Record audit event + update `last_used_at`.

**Implemented in S-0010:** External routes use the `/v1/ext/*` prefix with `externalAuth` middleware that validates the token hash against the DB, checks expiry and revocation, and verifies the required scope. The middleware also accepts an optional `requiredSubjectType` parameter; when provided, it validates that the token's `subject_type` matches the expected type for the endpoint (e.g., a quote-view endpoint requires `subject_type: 'quote'`). On any failure (invalid, expired, revoked, wrong scope, or wrong subject type) the middleware returns 403 with error code `LINK_INVALID`.

**Object existence after token lookup:** If a token is valid but the referenced object is missing or deleted, the endpoint must return 403 `LINK_INVALID` — not 404. This prevents leaking entity existence to external principals who may be probing with tokens from other objects.

### 4.7 Error handling for external pages
- Expired/revoked/invalid token → show a safe, generic message:
  - “This link is no longer valid. Contact <business>.”
- Do not reveal whether object exists across tenants.

---

## 5) Data protection & PII handling

### 5.1 PII classification (MVP)
Treat as PII:
- names, phone numbers, emails, addresses
- uploaded photos (often contain people/vehicles/license plates)
- notes from visits/jobs
- payment-related metadata (partial; avoid storing unnecessary details)

### 5.2 Data minimization rules
- Only store what is needed to execute the workflow.
- Avoid global uniqueness constraints on PII (usually per-tenant; often no uniqueness required).
- Prefer “soft delete” for tenant-owned entities if feasible (business decision).

### 5.3 Encryption
- In AWS:
  - RDS encryption at rest (enabled)
  - S3 SSE enabled (S3-managed or KMS later)
  - SQS SSE enabled
- In transit:
  - TLS everywhere (API Gateway, CloudFront)
- Local:
  - Accept local dev without TLS; avoid production secrets in local env files

---

## 6) Logging, redaction, and audit events

### 6.1 Never log
- Secure link tokens (plaintext)
- Authorization headers
- Stripe webhook raw payloads containing secrets
- Full PII fields (email/phone/address) unless explicitly masked
- SMS message bodies (optional policy—recommended to avoid or store minimal)

### 6.2 Redaction policy (required)
In logs:
- Replace tokens with `token=REDACTED`
- Mask emails and phones if they appear
- Strip query params that could include tokens

### 6.3 Audit events (required baseline)
Audit events must include:
- `tenant_id`
- principal type: `internal`, `system`, or `external`
- principal identifiers:
  - internal: `user_id`
  - external: `token_id` (db id, not token value)
- event name and timestamp
- subject reference (quote/invoice/client hub, subject id)
- optional: ip/user-agent (careful with PII policy)

Minimum audit events (MVP):
- `quote.sent`, `quote.viewed`, `quote.approved`, `quote.declined`
- `invoice.sent`, `invoice.viewed`, `invoice.paid`
- `hub.viewed`

---

## 7) Public endpoint abuse protection (baseline)

Applies to:
- public request form submissions
- local dev login endpoint (`POST /v1/auth/local/login`, 10 req/min, S-0027)
- any unauthenticated endpoints

Required controls:
- Honeypot field on the form
- Server-side rate limit by IP
  - local: in-memory sliding window is OK
  - prod: rely on API Gateway throttles and add WAF later if needed
  - **`trustProxy: true`** in Fastify so `request.ip` resolves the real client IP from `X-Forwarded-For` (required behind ALB/API Gateway)
- Basic logging of rejected attempts (no PII)

---

## 8) Web security posture (CSR app + API)

### 8.1 CORS policy
- Only allow the web app origin(s) for authenticated internal endpoints.
- External secure-link pages may be served from the same origin; keep CORS tight anyway.

### 8.2 CSRF
- For cookie-based auth, CSRF is relevant.
- For token-based Bearer auth (common for SPAs), CSRF risk is reduced.
- MVP guidance:
  - Internal auth uses Cognito JWT as Bearer token; CSRF risk is minimal for Bearer-based auth.
  - Do not store Cognito tokens in cookies. Store in memory (preferred) or `sessionStorage`.
  - Secure links should be one-time tokens in URL; do not store them in cookies

### 8.3 XSS
- Never inject unsanitized HTML.
- Treat notes fields as plain text.
- Use React default escaping; avoid `dangerouslySetInnerHTML` unless sanitized.

### 8.4 Clickjacking
- Set `X-Frame-Options: DENY` or CSP frame-ancestors (prod infra config).

### 8.5 Content Security Policy (CSP) (recommended)
- Basic CSP for production to reduce XSS impact.
- Keep local dev relaxed if needed for tooling.

---

## 9) S3 upload security (presigned URLs)

Rules:
- Presigned upload URLs must be scoped to:
  - tenant prefix + object type + object id
  - content-type restrictions where possible
  - size limits where possible
- Bucket is private; access via presigned URLs only.
- Never allow user-controlled paths outside tenant prefix.

Recommended key format:
- `tenants/<tenantId>/visits/<visitId>/photos/<uuid>.<ext>`

### 9.1 Presigned POST implementation (S-0016)

Visit photo uploads use **presigned POST policies** via `@aws-sdk/s3-presigned-post` (not presigned PUT) because presigned PUT cannot enforce file size limits server-side.

**Server-side enforcement (presigned POST conditions):**
- `content-length-range`: 1 byte to 10 MB (10,485,760 bytes)
- `Content-Type`: must match one of `image/jpeg`, `image/png`, `image/heic`, `image/webp`
- `key`: exact match to server-generated S3 key (no client control)
- Policy expiration: 15 minutes

**Client-side validation (defense in depth):**
- File type check before upload (JPEG, PNG, HEIC, WebP)
- File size check before upload (10 MB max)
- These are convenience checks; the presigned POST conditions are the real enforcement

**S3 key generation:**
- Server generates keys using the pattern `tenants/{tenantId}/visits/{visitId}/photos/{uuid}.{ext}`
- Extension derived from content type on the server, not from the client filename
- UUID generated server-side (`crypto.randomUUID()`)

**Photo lifecycle security:**
- Photos start as `pending` (DB record only); client uploads to S3 via presigned POST
- Confirm endpoint uses `SELECT ... FOR UPDATE` on the visit row to serialize concurrent confirms and enforce the hard cap (20 ready photos per visit)
- Stale pending records (>15 min) are cleaned up during new photo creation (best-effort S3 delete)
- Delete endpoint removes DB record and best-effort deletes S3 object

**LocalStack for local dev:**
- `docker-compose.yml` includes a `localstack` service for S3, SQS, and CDK support services (sts, cloudformation, ssm, iam)
- `scripts/localstack-deploy.sh` deploys the CDK stack (with `skipCognito=true`) to LocalStack, creating the S3 bucket with CORS and SQS queues; resource names/URLs are written to `.env.localstack`
- `S3_ENDPOINT` config var enables `forcePathStyle: true` for LocalStack compatibility
- `.env.localstack` contains only resource identifiers (bucket names, queue URLs) — no credentials, tokens, or secrets are persisted

---

## 10) Secrets management policy

### 10.1 Where secrets live
- Local: `.env` files (dev only) — never commit
- AWS: Secrets Manager or SSM Parameter Store (prod/dev sandbox)

### 10.2 Required secrets (examples)
- `SECURE_LINK_HMAC_SECRET`
- DB credentials (prod)
- Stripe webhook secret
- SMS configuration values (if sensitive)

Note: `COGNITO_USER_POOL_ID` and `COGNITO_CLIENT_ID` are not secrets (they are public in the JWT issuer URL and client-side config), but they are environment-specific and should be managed as config, not hardcoded.

### 10.3 Production validation of `SECURE_LINK_HMAC_SECRET`
In production (`NODE_ENV=production`), `loadConfig()` enforces the following rules for `SECURE_LINK_HMAC_SECRET`:
- Must not be missing or empty.
- Must not equal the dev default value `dev-secret-change-in-production`.
- Must be at least 16 characters long.

The app will refuse to start if any of these conditions are violated. This prevents accidental deployment with weak or default secrets.

### 10.4 Rotation rules (MVP)
- Design secrets so they can be rotated without code changes:
  - store secret in Secrets Manager/SSM
  - cache with TTL in Lambda/worker if needed

---

## 11) IAM least privilege (AWS baseline)

### 11.1 Lambda roles
- API Lambda:
  - read/write to RDS
  - publish to EventBridge (if used)
  - send messages to SQS queues
  - generate presigned S3 URLs (PutObject)
- Worker Lambda:
  - read/write to RDS
  - read message from SQS
  - send SMS (SMS v2) and email (SES) in prod
  - read/write S3 where needed

### 11.2 Scheduler role
- EventBridge Scheduler execution role must only have:
  - `sqs:SendMessage` to message jobs queue

---

## 12) Security reviews & audit cadence (required)

### 12.1 Regular audits
Perform these checks regularly:
- **Tenant boundary audit**
  - attempt cross-tenant access for every list and detail endpoint
  - ensure all queries include tenant filter
- **Secure link audit**
  - validate tenant-bound + object-bound + scope checks
  - confirm expiry/revocation and safe error messaging
- **PII/logging audit**
  - scan logs for tokens/PII
- **Responsive + a11y audit** (ties to UI/UX context)
  - end of every epic and before MVP release candidates

### 12.2 Change-driven reviews (required)
Any time you add or change:
- a public endpoint
- a secure link flow
- file upload/download features
- cross-tenant searchable lists
…you must add or update tests for the security invariants.

---

## 13) Agent instructions (how to implement security in this repo)

When an AI agent adds functionality:
1) Always pass `tenant_id` explicitly through service/repo boundaries (do not “infer” from params).
2) For secure links:
   - create token record with (tenant_id, subject, scopes, expiry)
   - store token hash only
   - validate token → derive auth context
   - enforce object binding + scope
   - record audit event
3) Never log secrets or tokens; use redaction helpers.
4) Add tests:
   - cross-tenant denial
   - token invalid/expired/revoked behavior
   - scope mismatch denial
5) Keep local dev working:
   - default `SMS_PROVIDER=outbox`
   - avoid AWS-only dependencies for unit tests (mock where appropriate)

---

## Appendix — Suggested tables (high-level)

### `secure_link_tokens` (recommended)
- `id` (pk)
- `tenant_id` (fk)
- `token_hash` (unique)
- `hash_version`
- `subject_type`
- `subject_id`
- `scopes` (jsonb or text[])
- `expires_at`
- `revoked_at`
- `created_by_user_id` (nullable)
- `created_at`
- `last_used_at` (nullable)

### `audit_events` (recommended baseline)
- `id`
- `tenant_id`
- `principal_type` (internal | system | external)
- `principal_id` (user_id or token_id)
- `event_name`
- `subject_type`
- `subject_id`
- `metadata` (nullable JSONB, S-0013 — e.g., `{ newStart, newEnd }` for `visit.time_set`)
- `created_at`
- optional: `ip`, `user_agent`
