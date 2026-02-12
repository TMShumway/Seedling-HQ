# S-0031: Cognito User Provisioning + Password Management

## Status: In Progress

## Overview
Closes the auth story arc (S-0027–S-0030) by adding user provisioning (DB + Cognito), forgot password, change own password, and DB role CHECK constraint.

## Key decisions
- Decision: CognitoProvisioner port — Chosen: explicit interface with provisionUser + setUserPassword — Why: clean separation, testable
- Decision: Re-provision semantics — Chosen: reuse disabled user's UUID on retry — Why: preserves username=users.id Cognito contract
- Decision: Mode-specific Zod schemas — Chosen: two schemas selected at route registration — Why: local requires password field, cognito doesn't
- Decision: ForbiddenError — Chosen: new AppError subclass (403) — Why: role guard needs distinct error from 401
- Decision: Role hierarchy — Chosen: owner>admin>member inline guards — Why: full RBAC deferred to S-0036

## Phase 1: DB Schema + Backend Infrastructure
**Goal:** CHECK constraint, ForbiddenError, UserRepository additions, CognitoProvisioner port
**Status:** Complete — Commit `d0633db`

- [x] CHECK constraints on users.role and users.status
- [x] ForbiddenError in errors.ts
- [x] UserRepository: 4 new methods (listByTenantId, updatePasswordHash, updateStatus, updateUser)
- [x] DrizzleUserRepository implementations
- [x] CognitoProvisioner port + AwsCognitoProvisioner + NoopCognitoProvisioner
- [x] Mock cascades in create-tenant.test.ts and send-request-notification.test.ts
- [x] AWS SDK dependency

## Phase 2: User Provisioning + List + Reset Password (Backend)
**Goal:** CreateUserUseCase, user routes, seed data, tests
**Status:** Complete — Commit `6f312a1`

- [x] CreateUserUseCase with new/re-provision paths
- [x] GET /v1/users (list team), POST /v1/users (create), POST /v1/users/:id/reset-password
- [x] Seed: DEMO_ADMIN_ID + DEMO_MEMBER_ID
- [x] Unit tests: 13 new (create-user.test.ts)
- [x] Integration tests: 12 new (user-routes.test.ts)

## Phase 3: Change Own Password (Backend)
**Goal:** POST /v1/users/me/password
**Status:** Complete — Commit `de5e2c4`

- [x] Change password endpoint (local mode, any role)
- [x] Integration tests: 4 new

## Phase 3b: Fix api-client 401 retry semantics
**Goal:** Additional edge-case tests for 401 retry
**Status:** Complete — Commit `d269719`

- [x] 3 new tests: 500 propagation, onAuthFailure await assertions

## Phase 4: Frontend — Team Management
**Goal:** TeamPage, InviteMemberForm, ResetPasswordDialog
**Status:** Complete — Commit `f6c6d64`

- [x] api-client: listUsers, createUser, resetUserPassword, changeMyPassword + CreateUserRequest type
- [x] TeamPage.tsx: table with role/status badges, invite button, reset password
- [x] InviteMemberForm.tsx: mode-specific (password for local, info for cognito)
- [x] ResetPasswordDialog.tsx: password + confirm
- [x] Sidebar: Team nav (UsersRound icon, between Invoices and Settings)
- [x] App.tsx: /team route

## Phase 5: Frontend — Password Management
**Goal:** Forgot password (cognito), change password in Settings (both modes)
**Status:** Complete

- [x] CognitoAuthClient: add forgotPassword, confirmForgotPassword, changePassword methods
- [x] AuthContext: add forgotPassword, confirmForgotPassword, changePassword to AuthContextValue
- [x] LoginPage: forgot-password steps (cognito: code flow; local: "contact admin" text)
- [x] SettingsPage: ChangePasswordForm section
- [x] ChangePasswordForm.tsx component

## Phase 6: E2E Tests
**Goal:** team.spec.ts and settings-password.spec.ts
**Status:** Not started

- [ ] team.spec.ts: roster display, invite, reset password
- [ ] settings-password.spec.ts: change password flow

## Phase 7: Documentation
**Goal:** CLAUDE.md + context doc updates
**Status:** Not started

- [ ] CLAUDE.md: key decisions + patterns for S-0031
- [ ] Domain model doc: audit events (user.created, user.reprovisioned, user.password_reset, user.password_changed)
- [ ] Remove provisioning + role constraint from deferred table

## Resume context
### Last completed
- Phase 5 (Frontend — Password Management)
- Files modified: cognito-client.ts, auth-context.tsx, LoginPage.tsx, SettingsPage.tsx
- File created: ChangePasswordForm.tsx

### Next up
- **Phase 6: E2E Tests** — team.spec.ts and settings-password.spec.ts

### Current test counts
- **API Unit**: 214 (13 new)
- **Web Unit**: 53 (3 new)
- **Integration**: 183 (18 new)
- **E2E**: not yet updated

### Branch
`story/S-0031-cognito-user-provisioning` — 6 commits ahead of main

### Commits so far
1. `d0633db` — Phase 1: DB schema + infrastructure
2. `6f312a1` — Phase 2: User CRUD routes + CreateUserUseCase
3. `de5e2c4` — Phase 3: Change-password endpoint
4. `d269719` — Phase 3b: 401 retry edge-case tests
5. `f6c6d64` — Phase 4: Frontend team management
