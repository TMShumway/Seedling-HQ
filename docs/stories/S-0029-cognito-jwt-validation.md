# S-0029: Cognito JWT Validation

## Status: Complete

## Overview
Implements JWT validation for `AUTH_MODE=cognito` so the API can authenticate requests using Cognito access tokens. Adds a pre-token-generation V2 Lambda trigger to copy `custom:tenant_id` into access tokens, renames the CDK `technician` group to `member`, defines a `JwtVerifier` port with `CognitoJwtVerifier` implementation using `jose`, and wires everything through the auth middleware and route layer.

**Scope:** Backend JWT validation + CDK updates (Lambda trigger + group rename). No frontend changes.

## Key decisions
- Decision: Token type — Chosen: Access token (not ID token) — Why: Security best practice; custom claims added via Lambda trigger
- Decision: JWT library — Chosen: `jose` — Why: ESM-native, zero-dep, built-in JWKS caching via `createRemoteJWKSet`
- Decision: Port interface — Chosen: `JwtVerifier` in `application/ports/` — Why: Follows existing pattern, enables mock-based testing
- Decision: User ID claim — Chosen: `username` (not `sub`) — Why: Cognito `sub` is auto-generated; `username` can be set to `users.id` at provisioning time. Contract documented in code comments; enforced at user provisioning time (future story).
- Decision: Role extraction — Chosen: `cognito:groups` with exactly-one enforcement — Why: Prevents ambiguous multi-group mapping; validates against `ROLES` from `domain/types/roles.ts`
- Decision: Canonical role name — Chosen: `member` (not `technician`) — Why: Product-neutral name
- Decision: Lambda packaging — Chosen: `Code.fromInline()` — Why: ~10 lines, no dependencies, no build step needed
- Decision: `aud` vs `client_id` — Chosen: Manual `payload.client_id` check — Why: Cognito access tokens use `client_id`, not `aud`. Must NOT pass `audience` to `jose.jwtVerify()`
- Decision: `buildAuthMiddleware` signature — Chosen: `({ config, jwtVerifier? })` object — Why: Clean dependency injection; all 9 route files get mechanical update
- Decision: Fail-fast startup — Chosen: `createApp()` creates `CognitoJwtVerifier` at startup when `AUTH_MODE=cognito` — Why: Catches misconfigurations at startup, not first request
- Decision: `CreateAppOptions` extension — Chosen: Optional `jwtVerifier` field — Why: Allows test injection; auto-created from config when not provided

## Phase 1: CDK Updates
**Goal:** Add pre-token-generation Lambda trigger, rename technician → member, set feature plan
**Files touched:** `infra/cdk/lib/dev-sandbox-stack.ts`

- [x] Task 1.1: Add featurePlan ESSENTIALS + Lambda trigger (V2_0, `Code.fromInline()`, copies `custom:tenant_id` into access token)
- [x] Task 1.2: Rename technician group to member

## Phase 2: Config + Port + CognitoJwtVerifier
**Goal:** Add jose, extend config, define port, implement verifier, unit test
**Files created:** `apps/api/src/application/ports/jwt-verifier.ts`, `apps/api/src/infra/auth/cognito-jwt-verifier.ts`, `apps/api/test/unit/cognito-jwt-verifier.test.ts`
**Files modified:** `apps/api/package.json`, `apps/api/src/shared/config.ts`, `apps/api/test/unit/config.test.ts`

- [x] Task 2.1: Add jose dependency
- [x] Task 2.2: Extend AppConfig with `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_REGION` + validate `AUTH_MODE` at runtime (rejects typos like `'cogntio'`)
- [x] Task 2.3: Add config unit tests (6 new: invalid AUTH_MODE, local mode without Cognito vars, 3 missing individual Cognito vars in cognito mode, all Cognito vars present)
- [x] Task 2.4: Define `JwtVerifier` port interface (`verify(token) → { tenantId, userId, role }`)
- [x] Task 2.5: Implement `CognitoJwtVerifier` (jose, JWKS, issuer, client_id, token_use=access, custom:tenant_id, username, cognito:groups with exactly-one enforcement + ROLES validation)
- [x] Task 2.6: Unit test CognitoJwtVerifier (15 tests: valid, expired, wrong issuer, wrong client_id, wrong token_use, missing/empty tenant_id, missing/empty groups, multiple groups, unknown group, wrong key, missing/empty username, all valid roles)

## Phase 3: Auth Middleware + Route Wiring + Tests
**Goal:** Wire JwtVerifier into middleware, update routes, fix tests, write middleware tests
**Files modified:**
- `apps/api/src/adapters/http/middleware/auth-middleware.ts` — cognito path: Bearer extraction → verify → authContext
- `apps/api/src/app.ts` — fail-fast verifier creation, `CreateAppOptions.jwtVerifier?`, pass to all route builders
- 9 route files: `tenant-routes.ts`, `user-routes.ts`, `business-settings-routes.ts`, `service-category-routes.ts`, `service-item-routes.ts`, `client-routes.ts`, `property-routes.ts`, `request-routes.ts`, `quote-routes.ts` — add `jwtVerifier?: JwtVerifier` to deps, change `buildAuthMiddleware(deps.config)` → `buildAuthMiddleware({ config: deps.config, jwtVerifier: deps.jwtVerifier })`
- 6 test files with `makeConfig()`: added `COGNITO_USER_POOL_ID: ''`, `COGNITO_CLIENT_ID: ''`, `COGNITO_REGION: ''`
  - `test/unit/auth-middleware.test.ts`, `test/unit/auth-login.test.ts`, `test/unit/send-quote.test.ts`, `test/unit/send-request-notification.test.ts`, `test/unit/respond-to-quote.test.ts`, `test/integration/setup.ts`
- `test/integration/setup.ts` — `buildTestApp()` accepts optional `{ jwtVerifier }` second arg
- `test/integration/auth-routes.test.ts` — cognito mode test passes mock verifier + fake Cognito config
- `test/unit/auth-login.test.ts` — cognito mode test passes no-op verifier + fake Cognito config

- [x] Task 3.1: Update `buildAuthMiddleware` signature + implement cognito path
- [x] Task 3.2: Update all `makeConfig` helpers with Cognito fields (6 files)
- [x] Task 3.3: Fix existing tests that set `AUTH_MODE: 'cognito'` (auth-login.test.ts, integration auth-routes.test.ts)
- [x] Task 3.4: Update 9 route files to pass jwtVerifier in deps
- [x] Task 3.5: Wire CognitoJwtVerifier in app.ts (fail-fast creation at startup)
- [x] Task 3.6: Write auth middleware unit tests for cognito path (5 tests: happy path, missing header, no Bearer prefix, verifier rejects, verifier not called in local mode)

**Also fixed pre-existing type errors:**
- `apps/api/src/adapters/http/routes/auth-routes.ts` — added 404 response schema (was returning 404 but schema only had 200)
- `apps/api/test/unit/send-quote.test.ts` — added `listBySubjects` to auditRepo mock in txRepos

## Phase 4: Integration Tests + Documentation
**Goal:** Integration tests, story file, doc updates
**Files created:** `docs/stories/S-0029-cognito-jwt-validation.md`
**Files modified:** `apps/api/test/integration/auth-routes.test.ts`, `CLAUDE.md`, 3 context docs

- [x] Task 4.1: Integration tests for cognito mode (3 tests: 401 without Authorization header, 401 with invalid Bearer token, 200 with mock verifier returning claims matching real seeded DB records)
- [x] Task 4.2: Create story file
- [x] Task 4.3: Update CLAUDE.md (9 new key decisions, 6 new established patterns, removed from deferred, fixed technician→member)
- [x] Task 4.4: Update context docs:
  - Architecture doc §4.1: marked JWT validation implemented, noted jose library, client_id not aud, username not sub, pre-token-generation Lambda, fixed technician→member in 3 places
  - Security doc §3.4: marked implemented, documented all 6 validation checks with implementation details
  - Security doc §3.2: fixed `user_id (from 'sub' claim)` → `user_id (from 'username' claim)` to match §3.4 (missed in initial pass)
  - Context-gaps doc: added S-0029 to recently resolved decisions

## Resume context
### Last completed
- All 4 phases complete. All tasks done.
- PR #68 opened: https://github.com/TMShumway/Seedling-HQ/pull/68
- Branch: `story/S-0029-cognito-jwt-validation` (4 commits, pushed)
- All tests passing: 192 unit, 150 integration, 74 E2E (34 skipped non-desktop)
- Typecheck clean

### Pending
- PR review and merge (use `gh pr merge --merge` per project convention)

### Deferred follow-ups (not in S-0029 scope)
- **`username = users.id` contract enforcement** — Cognito user provisioning story must set `username` to `users.id` when calling `AdminCreateUser`. S-0029 documents the contract in code comments.
- **DB CHECK constraint or enum for `role` column** — tracked but deferred
- **Frontend Cognito SDK** (PKCE flow, token storage, refresh) — separate story
- **Live Cognito E2E test** — deferred until user provisioning story provides real pool users

### Implementation gotchas encountered
- **jose v6 removed `KeyLike` export** — Unit tests needed `CryptoKey` type instead of `KeyLike` for RSA key pair typing
- **Fail-fast breaks existing `AUTH_MODE: 'cognito'` tests** — Two existing tests (`auth-login.test.ts`, integration `auth-routes.test.ts`) set `AUTH_MODE: 'cognito'` without a verifier. After fail-fast wiring in `createApp()`, they needed a no-op mock `jwtVerifier` + fake Cognito config values to avoid startup crash.
- **Integration tests require `pnpm test:integration`** — Direct `vitest run test/integration/...` uses the default unit test include pattern; must use the script which points to `vitest.integration.config.ts`

## Test summary
- **Unit**: 192 total (26 new: 6 config + 15 verifier + 5 middleware)
- **Integration**: 150 total (3 new: cognito 401 no header, 401 bad token, 200 valid mock)
- **E2E**: 0 new (no frontend changes; 74 existing all pass)

## Files changed (32 total)
```
infra/cdk/lib/dev-sandbox-stack.ts                              — CDK Lambda trigger + group rename
apps/api/package.json                                           — jose dependency
apps/api/src/shared/config.ts                                   — Cognito config fields + AUTH_MODE validation
apps/api/src/application/ports/jwt-verifier.ts                  — NEW: JwtVerifier port
apps/api/src/infra/auth/cognito-jwt-verifier.ts                 — NEW: CognitoJwtVerifier implementation
apps/api/src/adapters/http/middleware/auth-middleware.ts         — cognito path + signature change
apps/api/src/app.ts                                             — fail-fast verifier creation + wiring
apps/api/src/adapters/http/routes/tenant-routes.ts              — jwtVerifier in deps
apps/api/src/adapters/http/routes/user-routes.ts                — jwtVerifier in deps
apps/api/src/adapters/http/routes/business-settings-routes.ts   — jwtVerifier in deps
apps/api/src/adapters/http/routes/service-category-routes.ts    — jwtVerifier in deps
apps/api/src/adapters/http/routes/service-item-routes.ts        — jwtVerifier in deps
apps/api/src/adapters/http/routes/client-routes.ts              — jwtVerifier in deps
apps/api/src/adapters/http/routes/property-routes.ts            — jwtVerifier in deps
apps/api/src/adapters/http/routes/request-routes.ts             — jwtVerifier in deps
apps/api/src/adapters/http/routes/quote-routes.ts               — jwtVerifier in deps
apps/api/src/adapters/http/routes/auth-routes.ts                — fix pre-existing 404 type error
apps/api/test/unit/cognito-jwt-verifier.test.ts                 — NEW: 15 verifier tests
apps/api/test/unit/config.test.ts                               — 6 new config tests
apps/api/test/unit/auth-middleware.test.ts                       — 5 new cognito middleware tests
apps/api/test/unit/auth-login.test.ts                           — fix for cognito mode test
apps/api/test/unit/send-quote.test.ts                           — fix pre-existing mock + Cognito config
apps/api/test/unit/respond-to-quote.test.ts                     — Cognito config fields
apps/api/test/unit/send-request-notification.test.ts            — Cognito config fields
apps/api/test/integration/setup.ts                              — Cognito config + jwtVerifier param
apps/api/test/integration/auth-routes.test.ts                   — 3 new cognito integration tests
docs/stories/S-0029-cognito-jwt-validation.md                   — NEW: story file
CLAUDE.md                                                       — decisions + patterns + deferred
docs/context/seedling-hq_mvp-context_architecture_...           — §4.1 updated
docs/context/seedling-hq_security-baseline_...                  — §3.4 updated
docs/context/seedling-hq_context-gaps_...                       — S-0029 resolved
pnpm-lock.yaml                                                  — jose lockfile entry
```
