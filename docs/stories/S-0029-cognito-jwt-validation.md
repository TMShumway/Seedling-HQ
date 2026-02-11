# S-0029: Cognito JWT Validation

## Status: Complete

## Overview
Implements JWT validation for `AUTH_MODE=cognito` so the API can authenticate requests using Cognito access tokens. Adds a pre-token-generation V2 Lambda trigger to copy `custom:tenant_id` into access tokens, renames the CDK `technician` group to `member`, defines a `JwtVerifier` port with `CognitoJwtVerifier` implementation using `jose`, and wires everything through the auth middleware and route layer.

## Key decisions
- Decision: Token type — Chosen: Access token (not ID token) — Why: Security best practice; custom claims added via Lambda trigger
- Decision: JWT library — Chosen: `jose` — Why: ESM-native, zero-dep, built-in JWKS caching
- Decision: Port interface — Chosen: `JwtVerifier` in `application/ports/` — Why: Follows existing pattern, enables mock-based testing
- Decision: User ID claim — Chosen: `username` (not `sub`) — Why: Cognito `sub` is auto-generated; `username` can be set to `users.id` at provisioning time
- Decision: Role extraction — Chosen: `cognito:groups` with exactly-one enforcement — Why: Prevents ambiguous multi-group mapping
- Decision: Canonical role name — Chosen: `member` (not `technician`) — Why: Product-neutral name
- Decision: Lambda packaging — Chosen: `Code.fromInline()` — Why: ~10 lines, no dependencies, no build step needed
- Decision: `aud` vs `client_id` — Chosen: Manual `client_id` check — Why: Cognito access tokens use `client_id`, not `aud`

## Phase 1: CDK Updates
**Goal:** Add pre-token-generation Lambda trigger, rename technician → member, set feature plan
**Files touched:** `infra/cdk/lib/dev-sandbox-stack.ts`

- [x] Task 1.1: Add featurePlan ESSENTIALS + Lambda trigger
- [x] Task 1.2: Rename technician group to member

## Phase 2: Config + Port + CognitoJwtVerifier
**Goal:** Add jose, extend config, define port, implement verifier, unit test
**Files touched:** `apps/api/package.json`, `apps/api/src/shared/config.ts`, `apps/api/src/application/ports/jwt-verifier.ts`, `apps/api/src/infra/auth/cognito-jwt-verifier.ts`, `apps/api/test/unit/config.test.ts`, `apps/api/test/unit/cognito-jwt-verifier.test.ts`

- [x] Task 2.1: Add jose dependency
- [x] Task 2.2: Extend AppConfig with Cognito fields + validate AUTH_MODE
- [x] Task 2.3: Add config unit tests (6 new)
- [x] Task 2.4: Define JwtVerifier port interface
- [x] Task 2.5: Implement CognitoJwtVerifier
- [x] Task 2.6: Unit test CognitoJwtVerifier (15 tests)

## Phase 3: Auth Middleware + Route Wiring + Tests
**Goal:** Wire JwtVerifier into middleware, update routes, fix tests, write middleware tests
**Files touched:** `apps/api/src/adapters/http/middleware/auth-middleware.ts`, `apps/api/src/app.ts`, 9 route files, 6 test files

- [x] Task 3.1: Update buildAuthMiddleware signature + implement cognito path
- [x] Task 3.2: Update all makeConfig helpers with Cognito fields
- [x] Task 3.3: Fix existing tests that set AUTH_MODE=cognito
- [x] Task 3.4: Update 9 route files to pass jwtVerifier in deps
- [x] Task 3.5: Wire CognitoJwtVerifier in app.ts (fail-fast)
- [x] Task 3.6: Write auth middleware unit tests for cognito path (5 tests)

## Phase 4: Integration Tests + Documentation
**Goal:** Integration tests, story file, doc updates
**Files touched:** `apps/api/test/integration/auth-routes.test.ts`, `apps/api/test/integration/setup.ts`, `docs/stories/S-0029-cognito-jwt-validation.md`, `CLAUDE.md`, context docs

- [x] Task 4.1: Integration tests for cognito mode (3 tests)
- [x] Task 4.2: Create story file
- [x] Task 4.3: Update CLAUDE.md
- [x] Task 4.4: Update context docs

## Resume context
### Last completed
- All phases complete

## Test summary
- **Unit**: 192 total (26 new: 6 config + 15 verifier + 5 middleware)
- **Integration**: 150 total (3 new: cognito 401 no header, 401 bad token, 200 valid mock)
- **E2E**: 0 new (no frontend changes)
