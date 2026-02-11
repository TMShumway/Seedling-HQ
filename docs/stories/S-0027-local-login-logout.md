# S-0027: Local Login/Logout Page

## Status: In Progress

## Overview
Add a proper login/logout UX for `AUTH_MODE=local` so developers and testers see a real auth flow. Includes a backend login endpoint with cross-tenant email lookup, a frontend login page with account picker, AuthGuard wrapping authenticated routes, and logout buttons in the sidebar/drawer.

## Key decisions
- Decision: Cross-tenant email lookup — Chosen: New `listActiveByEmail(email)` method on UserRepository — Why: Existing `getByEmail(tenantId, email)` is tenant-scoped; login needs cross-tenant lookup
- Decision: Route file — Chosen: New `auth-routes.ts` — Why: Login is a distinct concern; doesn't fit existing route files
- Decision: AUTH_MODE guard — Chosen: Return 404 when `AUTH_MODE !== 'local'` — Why: Endpoint shouldn't exist in cognito mode
- Decision: AuthGuard — Chosen: React component wrapping AppShell Route — Why: Simplest React Router integration
- Decision: Login page — Chosen: Outside AppShell (same as SignupPage) — Why: User is unauthenticated
- Decision: Login API call — Chosen: Use `publicRequest()` — Why: User has no auth headers yet
- Decision: Rate limit — Chosen: 10 req/min per IP — Why: Slightly more generous than public request form

## Phase 1: Backend — UserRepository extension + Login endpoint + Tests
**Goal:** Add cross-tenant email lookup and `POST /v1/auth/local/login` endpoint with rate limiting, AUTH_MODE guard, unit tests, and integration tests.

- [x] **Task 1.1: Add `listActiveByEmail` to UserRepository port**
- [x] **Task 1.2: Implement `listActiveByEmail` in DrizzleUserRepository**
- [x] **Task 1.3: Create `auth-routes.ts` with `POST /v1/auth/local/login`**
- [x] **Task 1.4: Register auth routes in `app.ts`**
- [x] **Task 1.5: Write unit tests**
- [x] **Task 1.6: Write integration tests**

## Phase 2: Frontend — Login page + AuthGuard + Logout
**Goal:** Create login page, AuthGuard wrapper, logout buttons, signup cross-link, and API client method.

- [x] **Task 2.1: Add `localLogin` to API client**
- [x] **Task 2.2: Create AuthGuard component**
- [x] **Task 2.3: Create LoginPage component**
- [x] **Task 2.4: Wire LoginPage + AuthGuard into App.tsx**
- [x] **Task 2.5: Add logout button to Sidebar**
- [x] **Task 2.6: Add logout button to MobileDrawer**
- [x] **Task 2.7: Add cross-links between SignupPage and LoginPage**

## Phase 3: E2E Migration + New E2E Tests
**Goal:** Fix existing E2E tests broken by AuthGuard, add new login/logout E2E tests.

- [x] **Task 3.1: Create `e2e/helpers/auth.ts` helper**
- [x] **Task 3.2: Add `setDemoAuth` to all existing E2E test files**
- [x] **Task 3.3: Write new E2E test: login flow**
- [x] **Task 3.4: Accessibility test for login page**

## Phase 4: Documentation + CLAUDE.md Updates
**Goal:** Update CLAUDE.md with new patterns and decisions, run full test suite.

- [ ] **Task 4.1: Update CLAUDE.md key decisions table**
- [ ] **Task 4.2: Update CLAUDE.md patterns tables**
- [ ] **Task 4.3: Run full test suite and verify**

## Resume context
### Last completed
- Phase 3 complete: E2E migration + new login/logout/a11y tests
- Created `e2e/helpers/auth.ts` with `setDemoAuth()` using `page.addInitScript()`
- Added `setDemoAuth` beforeEach to 8 existing E2E files
- Created `e2e/tests/login.spec.ts` (7 tests: redirect, login, unknown email, logout, hint, cross-link, a11y)
- Logout test uses `page.evaluate()` to set localStorage (not `addInitScript`) to properly test cleanup
### In progress
- Starting Phase 4: CLAUDE.md updates and final verification
### Next up
- Task 4.1: Update CLAUDE.md key decisions table
### Blockers / open questions
- None

## Test summary
- **Unit**: 166 total (3 new)
- **Integration**: 145 total (8 new)
- **E2E**: 108 total (74 run + 34 skipped) — 20 new
