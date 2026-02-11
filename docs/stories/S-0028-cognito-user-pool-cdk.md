# S-0028: Cognito User Pool Infrastructure (CDK)

## Status: Complete

## Overview
Provisions the AWS Cognito User Pool, Groups, and App Client via CDK as a prerequisite for future JWT validation (S-0029+) and admin user creation stories. Creates a standalone CDK workspace under `infra/cdk/` independent of the pnpm workspace.

## Key decisions
- Decision: CDK workspace location — Chosen: standalone `infra/cdk/` with own `package.json`, NOT in `pnpm-workspace.yaml` — Why: CDK has different deps/toolchain; isolation prevents conflicts
- Decision: Username — Chosen: auto-generated UUID (NOT email) — Why: Enables same-email-across-tenants; each (tenant, email) pair gets its own Cognito user
- Decision: Email attribute — Chosen: required, NOT unique, NOT an alias — Why: Multiple Cognito users can share an email; login goes through our lookup endpoint
- Decision: Custom attribute — Chosen: `custom:tenant_id` (string, immutable) — Why: Binds JWT to tenant; immutable prevents cross-tenant moves
- Decision: Groups — Chosen: `owner`, `admin`, `technician` — Why: Maps to application roles via `cognito:groups` claim
- Decision: Auth flow — Chosen: PKCE (no client secret) — Why: Industry standard for SPAs; no secret exposure risk
- Decision: Self-signup — Chosen: disabled — Why: Users created only via Admin API during tenant signup
- Decision: Token TTLs — Chosen: access 1h, ID 1h, refresh 30d — Why: Short-lived access for security; 30d refresh for UX
- Decision: Naming convention — Chosen: `fsa-<env>-<owner>-<resource>` — Why: Matches existing AWS naming pattern from architecture doc

## Phase 1: Scaffold CDK Workspace
**Goal:** Create independent CDK workspace with TypeScript tooling and entry point.
**Files created:** `infra/cdk/package.json`, `infra/cdk/tsconfig.json`, `infra/cdk/cdk.json`, `infra/cdk/bin/dev-sandbox.ts`

- [x] **Task 1.1: Create `infra/cdk/package.json`**
- [x] **Task 1.2: Create `infra/cdk/tsconfig.json`**
- [x] **Task 1.3: Create `infra/cdk/cdk.json`**
- [x] **Task 1.4: Create `infra/cdk/bin/dev-sandbox.ts` (stub)**

## Phase 2: Implement Cognito Stack
**Goal:** Build the CDK stack construct that provisions User Pool, Groups, and App Client.
**Files created:** `infra/cdk/lib/dev-sandbox-stack.ts`
**Files modified:** `infra/cdk/bin/dev-sandbox.ts`

- [x] **Task 2.1: Create `DevSandboxStack` with User Pool**
- [x] **Task 2.2: Add Cognito Groups**
- [x] **Task 2.3: Add App Client with PKCE**
- [x] **Task 2.4: Add stack outputs**
- [x] **Task 2.5: Wire stack into bin entry point**

## Phase 3: Project Configuration Updates
**Goal:** Update root project files to support CDK workspace.
**Files modified:** `.gitignore`, `.env.example`

- [x] **Task 3.1: Update `.gitignore`**
- [x] **Task 3.2: Update `.env.example`**

## Phase 4: Documentation
**Goal:** Create story file, update CLAUDE.md and context docs.
**Files created:** `docs/stories/S-0028-cognito-user-pool-cdk.md`
**Files modified:** `CLAUDE.md`, architecture doc, domain model doc

- [x] **Task 4.1: Create story file**
- [x] **Task 4.2: Update CLAUDE.md**
- [x] **Task 4.3: Update architecture doc**
- [x] **Task 4.4: Update domain model doc**
- [x] **Task 4.5: Verify `cdk synth` and inspect template**

## Resume context
N/A — story complete.

## Test summary
- **Unit**: N/A (infra story — no application code changes)
- **Integration**: N/A
- **E2E**: N/A
- **Verification**: `cdk synth --context env=dev --context owner=test` produces valid CloudFormation template with User Pool, 3 Groups, App Client (PKCE), and 5 Outputs
