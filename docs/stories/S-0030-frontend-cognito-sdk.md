# S-0030: Frontend Cognito SDK Integration

## Status: Complete

## Overview
Added real Cognito authentication to the React frontend so `AUTH_MODE=cognito` works end-to-end. The frontend now supports dual-mode auth: local dev headers (localStorage) and Cognito JWT (sessionStorage via SDK). Includes email-to-username lookup endpoint, token storage, refresh, logout, and NEW_PASSWORD_REQUIRED challenge handling.

## Key decisions
- Decision: SDK — Chosen: `amazon-cognito-identity-js` (~18KB gzipped) — Why: Zero-framework dependency, custom storage adapter support, SRP built-in
- Decision: Auth flow — Chosen: `USER_PASSWORD_AUTH` (set explicitly on CognitoUser) — Why: Simpler than SRP for UUID usernames; works with admin-provisioned users
- Decision: Token storage — Chosen: sessionStorage via custom `ICognitoStorage` — Why: Survives page refresh, cleared on tab close (better security than localStorage)
- Decision: Auth state — Chosen: `AuthProvider` React context + `useAuth()` hook — Why: Dual-mode (local/cognito) with consistent API across the app
- Decision: Mode detection — Chosen: `VITE_AUTH_MODE` env var (build-time) — Why: Defaults to `'local'` when unset; Vite requires `VITE_` prefix for client-side env vars
- Decision: Token refresh — Chosen: On-demand in `getToken()` — Why: Refresh if <5min remaining; avoids background polling complexity
- Decision: Email-to-username mapping — Chosen: `POST /v1/auth/cognito/lookup` backend endpoint — Why: Cognito usernames are UUIDs; users log in with email; backend resolves email → username + User Pool ID
- Decision: api-client auth — Chosen: `setAuthProvider({ getToken, forceRefresh, onAuthFailure })` — Why: 401 retry with explicit failure paths; decouples api-client from auth implementation
- Decision: NEW_PASSWORD_REQUIRED — Chosen: Inline "Set new password" form in LoginPage — Why: Admin-created users must set password on first login; separate page unnecessary
- Decision: Signup in cognito mode — Chosen: Disabled — Why: Self-signup disabled in Cognito; shows "Contact admin" message; backend returns 404 on `POST /v1/tenants`
- Decision: Logout — Chosen: State-driven via AuthGuard, not imperative `navigate()` — Why: Avoids race conditions; clearing auth state triggers AuthGuard redirect naturally
- Decision: Buffer polyfill — Chosen: Required for `amazon-cognito-identity-js` in browser — Why: Vite doesn't polyfill Node builtins; SDK uses `Buffer` internally

## Phase 1: Auth Infrastructure
**Goal:** Add dependencies, create auth config, storage adapter, Cognito client wrapper, and AuthProvider context.
**Files created:** `apps/web/src/auth/auth-config.ts`, `apps/web/src/auth/cognito-storage.ts`, `apps/web/src/auth/cognito-client.ts`, `apps/web/src/auth/auth-context.tsx`, `apps/web/src/auth/index.ts`, `apps/web/vitest.config.ts`, `apps/web/test/unit/auth-config.test.ts`, `apps/web/test/unit/cognito-storage.test.ts`
**Files modified:** `apps/web/package.json`, `apps/web/src/vite-env.d.ts`, `apps/web/vite.config.ts`, `.env.example`, `apps/web/src/api-client.ts`

- [x] **Task 1.1: Add dependencies + vitest config + envDir**
  - Acceptance: `amazon-cognito-identity-js` and `buffer` in dependencies; vitest config resolves tests; `envDir` points to monorepo root
  - [x] Add `amazon-cognito-identity-js` and `buffer` to `apps/web/package.json`
  - [x] Create `apps/web/vitest.config.ts` for web unit tests
  - [x] Set `envDir: '../..'` in `vite.config.ts` so `VITE_*` vars load from root `.env`
- [x] **Task 1.2: Auth config module + env var types**
  - Acceptance: `getAuthConfig()` returns mode + Cognito settings; `vite-env.d.ts` declares `VITE_AUTH_MODE`, `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, `VITE_COGNITO_REGION`; 9 unit tests pass
  - [x] Extend `vite-env.d.ts` with `VITE_AUTH_MODE`, `VITE_COGNITO_*` env vars
  - [x] Create `auth-config.ts` with `getAuthConfig()` returning typed config
  - [x] Write unit tests for auth-config (9 tests)
- [x] **Task 1.3: Custom ICognitoStorage (sessionStorage adapter)**
  - Acceptance: `CognitoSessionStorage` implements `ICognitoStorage` interface; delegates to `sessionStorage`; 6 unit tests pass
  - [x] Create `cognito-storage.ts` implementing `ICognitoStorage`
  - [x] Write unit tests for cognito-storage (6 tests)
- [x] **Task 1.4: CognitoAuthClient wrapper**
  - Acceptance: `CognitoAuthClient` wraps SDK with `login()`, `completeNewPassword()`, `getToken()`, `logout()`, `isAuthenticated()` methods
  - [x] Create `cognito-client.ts` with `CognitoAuthClient` class
  - [x] Handle `USER_PASSWORD_AUTH` flow and `NEW_PASSWORD_REQUIRED` challenge
- [x] **Task 1.5: AuthProvider + useAuth hook**
  - Acceptance: `AuthProvider` context provides `{ isAuthenticated, isLoading, login, logout, getToken, mode }` to the component tree; dual-mode (local/cognito)
  - [x] Create `auth-context.tsx` with `AuthProvider` and `useAuth()` hook
  - [x] Export all auth modules from `auth/index.ts`

## Phase 2: Backend Changes
**Goal:** Add `POST /v1/auth/cognito/lookup` endpoint + gate `POST /v1/tenants` in cognito mode.
**Files modified:** `apps/api/src/adapters/http/routes/auth-routes.ts`, `apps/api/src/adapters/http/routes/tenant-routes.ts`, `apps/api/test/unit/auth-routes.test.ts`, `apps/api/test/integration/auth-routes.test.ts`, `apps/api/test/unit/tenant-routes.test.ts`, `apps/api/test/integration/tenant-routes.test.ts`

- [x] **Task 2.1: Add cognito lookup route**
  - Acceptance: `POST /v1/auth/cognito/lookup` accepts `{ email }`, returns `{ username, userPoolId }` when `AUTH_MODE=cognito`; returns 404 when `AUTH_MODE=local`
  - [x] Add route to `auth-routes.ts` with rate limiting
  - [x] Implement cross-tenant email → username resolution
- [x] **Task 2.2: Add cognito lookup integration tests**
  - Acceptance: 6 integration tests pass (cognito mode: valid email, unknown email, invalid email; local mode: 404; rate limit; missing body)
  - [x] Write integration tests in `auth-routes.test.ts`
- [x] **Task 2.3: Gate POST /v1/tenants in cognito mode**
  - Acceptance: `POST /v1/tenants` returns 404 when `AUTH_MODE=cognito`; 1 new integration test passes
  - [x] Add mode check to `tenant-routes.ts`
  - [x] Write integration test for tenant creation gate

## Phase 3: Wire Components
**Goal:** Replace localStorage reads with `useAuth()` throughout the app. Enable dual-mode login.
**Files modified:** `apps/web/src/App.tsx`, `apps/web/src/components/AuthGuard.tsx`, `apps/web/src/pages/LoginPage.tsx`, `apps/web/src/pages/SignupPage.tsx`, `apps/web/src/components/layout/Sidebar.tsx`, `apps/web/src/components/layout/MobileDrawer.tsx`, `apps/web/vite.config.ts`, `apps/web/package.json`

- [x] **Task 3.1: Update api-client.ts with auth provider pattern**
  - Acceptance: `setAuthProvider()` function accepts `{ getToken, forceRefresh, onAuthFailure }`; `request()` calls `getToken()` for auth header; 401 triggers retry with `forceRefresh()`
  - [x] Add `setAuthProvider` and `clearAuthProvider` functions
  - [x] Update `request()` to use auth provider when set (cognito mode) or localStorage headers (local mode)
  - [x] Implement 401 retry logic with force refresh
- [x] **Task 3.2: Wrap App.tsx with AuthProvider + rewrite AuthGuard**
  - Acceptance: `<AuthProvider>` wraps entire app in `App.tsx`; `AuthGuard` uses `useAuth()` instead of direct localStorage checks
  - [x] Add `<AuthProvider>` wrapper in `App.tsx`
  - [x] Rewrite `AuthGuard` to use `useAuth()` hook
  - [x] Show loading state while auth initializes
- [x] **Task 3.3: Update LoginPage for dual mode**
  - Acceptance: Local mode uses existing email → account picker flow; Cognito mode uses email → lookup → password → authenticate; NEW_PASSWORD_REQUIRED shows inline password form
  - [x] Add cognito login flow with email → lookup → password steps
  - [x] Add NEW_PASSWORD_REQUIRED challenge handling
  - [x] Preserve local mode flow unchanged
- [x] **Task 3.4: Update SignupPage + Sidebar + MobileDrawer**
  - Acceptance: SignupPage shows "Contact admin" in cognito mode; Sidebar/MobileDrawer logout calls `useAuth().logout()`; `queryClient.clear()` on logout
  - [x] Conditionally render SignupPage based on auth mode
  - [x] Update logout handlers in Sidebar and MobileDrawer

## Phase 4: Tests + Verification + Documentation
**Goal:** Unit tests for auth modules, verify existing E2E still pass, update docs.
**Files created:** `apps/web/test/unit/cognito-client.test.ts`, `apps/web/test/unit/auth-context.test.tsx`, `docs/stories/S-0030-frontend-cognito-sdk.md`

- [x] **Task 4.1: Unit tests for CognitoAuthClient**
  - Acceptance: 13 unit tests pass covering login, NEW_PASSWORD_REQUIRED, getToken (valid/expired/refresh), logout, isAuthenticated, error handling
  - [x] Mock `amazon-cognito-identity-js` SDK
  - [x] Test all CognitoAuthClient methods and error paths
- [x] **Task 4.2: Unit tests for AuthProvider**
  - Acceptance: 15 unit tests pass covering local mode init, cognito mode init, login/logout state transitions, loading states, getToken delegation
  - [x] Test dual-mode initialization
  - [x] Test auth state transitions
  - [x] Test error handling and edge cases
- [x] **Task 4.3: Verify full test suite + typecheck**
  - Acceptance: All existing tests still pass; `tsc --noEmit` clean; no regressions
  - [x] Run full unit test suite (API + web)
  - [x] Run full integration test suite
  - [x] Run E2E tests
  - [x] Run TypeScript typecheck
- [x] **Task 4.4: Create story file + update docs**
  - Acceptance: Story file created at `docs/stories/S-0030-frontend-cognito-sdk.md`; CLAUDE.md updated with new key decisions and established patterns; context docs updated
  - [x] Create story file
  - [x] Update CLAUDE.md with new decisions and patterns
  - [x] Update domain model doc (renumber S-0030→S-0032, add S-0030/S-0031)
  - [x] Update architecture doc §4.1 (token storage, AUTH_MODE section, lookup/gate notes)
  - [x] Update security doc §3.4 (frontend token lifecycle)
  - [x] Update context-gaps doc (add S-0030 to resolved decisions)

## Addendum: Local Mode Password Verification

### Overview
Added real password verification to local mode so the dev login UX mirrors cognito production. Previously local mode accepted any password — now it uses scrypt hashing and a verify endpoint.

### Key decisions (addendum)
- Decision: Hashing — Chosen: `node:crypto` scrypt — Why: Zero deps, OWASP-recommended KDF, already using `node:crypto` for HMAC in `shared/crypto.ts`
- Decision: Stored format — Chosen: `scrypt:N:r:p:salt_hex:hash_hex` — Why: Self-describing, future-proof parameter changes
- Decision: Endpoint — Chosen: Separate `POST /v1/auth/local/verify` — Why: Keeps email-lookup and password-verify as distinct steps (mirrors cognito where lookup and `authenticateUser` are separate)
- Decision: Column — Chosen: Nullable `password_hash` varchar(255) — Why: Cognito-mode users don't need local passwords; existing users without passwords return 401 on verify
- Decision: Demo password — Chosen: `password` — Why: Simple, obvious; hint text updated to `owner@demo.local / password`

### Addendum Phase 1: Backend schema + password utility
**Files created:** `apps/api/src/shared/password.ts`
**Files modified:** `apps/api/src/infra/db/schema.ts`, `apps/api/src/domain/entities/user.ts`, `apps/api/src/application/ports/user-repository.ts`, `apps/api/src/infra/db/repositories/drizzle-user-repository.ts`, `apps/api/src/infra/db/seed.ts`, `apps/api/src/application/usecases/create-tenant.ts`, `apps/api/test/unit/create-tenant.test.ts`, `apps/api/test/unit/respond-to-quote.test.ts`, `apps/api/test/unit/send-request-notification.test.ts`, `apps/web/src/lib/auth/auth-context.tsx`, `apps/web/src/pages/LoginPage.tsx`

- [x] Create `password.ts` with `hashPassword()` / `verifyPassword()` using scrypt
- [x] Add `password_hash` nullable column to users schema
- [x] Add `passwordHash` field to User entity
- [x] Add `getByIdGlobal(id)` to UserRepository port + Drizzle impl
- [x] Update `create-tenant.ts` to pass `passwordHash: null` (placeholder)
- [x] Seed demo user with hashed `"password"`
- [x] Update all unit test mocks (3 files) for new `passwordHash` field + `getByIdGlobal`
- [x] Update auth-context `selectAccount` to always return false (password needed)
- [x] Fix missing `isCognitoMode` import in LoginPage

### Addendum Phase 2+3: Verify endpoint + signup password
**Files modified:** `apps/api/src/adapters/http/routes/auth-routes.ts`, `apps/api/src/adapters/http/routes/tenant-routes.ts`, `apps/api/src/application/dto/create-tenant-dto.ts`, `apps/api/src/application/usecases/create-tenant.ts`, `apps/api/test/integration/auth-routes.test.ts`

- [x] Add `POST /v1/auth/local/verify` route (userId + password → user info, rate limited 10/min, 404 in cognito mode)
- [x] Add `ownerPassword` required field to `CreateTenantInput` DTO
- [x] Add `ownerPassword` required to tenant-routes Zod body schema (min 8, max 128 chars)
- [x] Always hash password during tenant creation
- [x] 7 new integration tests (correct pw, wrong pw, unknown user, no hash, 404 cognito, invalid UUID, rate limit)

### Addendum Phase 4: Frontend
**Files modified:** `apps/web/src/lib/api-client.ts`, `apps/web/src/lib/auth/auth-context.tsx`, `apps/web/src/pages/LoginPage.tsx`, `apps/web/src/pages/SignupPage.tsx`

- [x] Add `localVerify()` and `LocalVerifyResponse` to api-client
- [x] Add `ownerPassword` to `CreateTenantRequest` type
- [x] Update `authenticate()` local mode to call `localVerify()` instead of accepting any password
- [x] Update LoginPage hint text to `"owner@demo.local / password"`
- [x] Update LoginPage error handling for 401 from verify endpoint (ApiClientError check)
- [x] Add password + confirm fields to SignupPage
- [x] SignupPage calls `authenticate(ownerPassword)` after `createTenant` for auto-login

### Addendum Phase 5: Tests
**Files created:** `apps/api/test/unit/password.test.ts`, `apps/web/test/unit/api-client.test.ts`
**Files modified:** `apps/web/test/unit/auth-context.test.tsx`, `e2e/tests/login.spec.ts`, `e2e/tests/signup.spec.ts`

- [x] 7 password.ts unit tests (hash format, salt uniqueness, verify correct/wrong/malformed/empty, unicode)
- [x] 5 api-client.test.ts unit tests (401 retry: success, refresh fail logout, retry 401 logout, network error no logout, no provider no retry)
- [x] Update auth-context tests: `selectAccount` returns false, add `authenticate` success + failure tests, add `mockLocalVerify` mock
- [x] Update login E2E: combined email+password form, update hint text assertion
- [x] Update signup E2E: fill password + confirm fields in all 3 tests (main, a11y, mobile)

### Addendum Phase 6: Docs
**Files modified:** `CLAUDE.md`

- [x] Add 6 key decisions, 3 backend patterns, 2 frontend patterns to CLAUDE.md

## Test summary
- **API unit**: 201 total (7 new password tests)
- **Web unit**: 50 total (5 new api-client retry tests + 2 new auth-context tests + 1 updated selectAccount test)
- **API integration**: 165 total (7 new verify endpoint + 1 new ownerPassword-missing test)
- **E2E**: 108 total / 74 run / 34 skipped non-desktop (0 new, login + signup updated)

## Resume context

### Current state
All phases complete (original S-0030 + addendum). Branch `story/S-0030-frontend-cognito-sdk` is pushed with PR #69 open.

### What was completed
**Original S-0030 (phases 1-4):** Full Cognito SDK frontend integration with dual-mode auth, auth-context, cognito-client, login/signup/logout, backend lookup endpoint + tenant gate.

**Addendum (phases 1-6):** Local mode password verification:
- `apps/api/src/shared/password.ts` — scrypt hash/verify utility
- `apps/api/src/infra/db/schema.ts` — `password_hash` nullable column on users
- `apps/api/src/domain/entities/user.ts` — `passwordHash: string | null` field
- `apps/api/src/application/ports/user-repository.ts` — `getByIdGlobal(id)` added
- `apps/api/src/infra/db/repositories/drizzle-user-repository.ts` — `passwordHash` in toEntity/create, `getByIdGlobal` impl
- `apps/api/src/adapters/http/routes/auth-routes.ts` — `POST /v1/auth/local/verify` (rate limited, 404 in cognito)
- `apps/api/src/application/dto/create-tenant-dto.ts` — `ownerPassword: string` (required)
- `apps/api/src/application/usecases/create-tenant.ts` — always hashes password (ownerPassword required)
- `apps/api/src/adapters/http/routes/tenant-routes.ts` — `ownerPassword` required in Zod body schema (min 8, max 128)
- `apps/api/src/infra/db/seed.ts` — demo user hashed with `"password"`
- `apps/web/src/lib/api-client.ts` — `localVerify()`, `ownerPassword` in `CreateTenantRequest`
- `apps/web/src/lib/auth/auth-context.tsx` — `selectAccount` always returns false, `authenticate` calls `localVerify` in local mode
- `apps/web/src/pages/LoginPage.tsx` — combined email+password form (step machine: `login` → `accounts` → `new-password`), hint text updated, 401 error handling for verify
- `apps/web/src/pages/SignupPage.tsx` — password + confirm fields, auto-authenticate after create
- `apps/web/src/lib/api-client.ts` — 401 retry restructured: 3 distinct failure paths (forceRefresh fail → logout, retry 401 → logout, network error → no logout)
- Unit test mocks updated in 3 files for `passwordHash` + `getByIdGlobal`

### Commits on branch (10 total)
1. `2ba4539` S-0030 phase 1: Add auth infrastructure for Cognito SDK integration
2. `7aaa70f` S-0030 phase 2: Add cognito lookup endpoint and tenant creation gate
3. `d355146` S-0030 phase 3: Wire AuthProvider into components for dual-mode auth
4. `42c990e` S-0030 phase 4: Add unit tests and update documentation
5. `9771676` S-0030: Fix auth failure on token retrieval and rate-limit isolation
6. `def16fe` S-0030 addendum phase 1: Add password infrastructure
7. `ef6ec2c` S-0030 addendum phase 2+3: Add verify endpoint and signup password
8. `9ccfe49` S-0030 addendum phase 4: Wire frontend password flow
9. `4a67089` S-0030 addendum phase 5: Add tests for password flow
10. `dc05280` S-0030 addendum phase 6: Update documentation

### PR status
- PR #69: https://github.com/TMShumway/Seedling-HQ/pull/69
- Title: "S-0030: Frontend Cognito SDK integration"
- Description updated with addendum section and new test counts
- Pushed to remote, awaiting review
- Merge strategy: merge commits (`gh pr merge --merge`)

### Next up
- PR review and merge
- No outstanding work on this branch

### Blockers / open questions
- None
