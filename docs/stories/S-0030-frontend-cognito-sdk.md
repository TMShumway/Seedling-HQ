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

## Test summary
- **Web unit**: 43 total (43 new: 9 auth-config, 6 cognito-storage, 13 cognito-client, 15 auth-context)
- **API unit**: 194 total (0 new)
- **API integration**: 157 total (7 new: 6 cognito lookup, 1 tenant gate)
- **E2E**: 108 total / 74 run / 34 skipped non-desktop (0 new, all existing pass)

## Resume context
All phases complete. Story delivered.
