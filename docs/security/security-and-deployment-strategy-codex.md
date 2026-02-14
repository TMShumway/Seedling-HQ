# Security and Deployment Strategy

## Status

- Canonical strategy document for security controls, deployment, and CI/CD.
- Supersedes:
  - `docs/security/security-platform-implementation-strategy.md`

## Purpose

Define a practical, high-assurance security model for SeedlingHQ that minimizes leakage risk (information, access, keys, secrets), enforces checks and balances, and maps every policy control to a concrete AWS implementation.

## Reality Check

Absolute security is not achievable. The target is:
- Prevent most attacks by design.
- Detect abuse quickly.
- Contain impact quickly.
- Recover safely with evidence.

## Security Principles

- Default deny everywhere.
- Least privilege for people and systems.
- Short-lived credentials over static credentials.
- Explicit scoping for every action (tenant, object, role, scope).
- Full auditability for sensitive actions.
- Separation of duties for high-risk changes.
- Secrets never leave AWS.

---

## Architecture Decisions

| Decision | Choice |
|----------|--------|
| API compute | AWS Lambda + API Gateway (serverless Fastify via `@fastify/aws-lambda`) |
| Frontend hosting | CloudFront + S3 (global CDN, SPA routing) |
| Database | RDS Postgres 17 + RDS Proxy (connection pooling for Lambda) |
| Account isolation | Two AWS accounts via AWS Organizations (dev + prod) |
| VPC egress | NAT Gateway for Lambda internet access |
| Prod deploy trigger | Manual with approval gate |
| Secrets storage | AWS Secrets Manager (never in .env, GitHub, or logs) |
| CI/CD auth | GitHub OIDC → IAM Role (no long-lived AWS keys) |
| Human auth | AWS SSO / Identity Center (temporary sessions) |

---

## 1) Identity and Access Control

### Policy controls
- Enforce MFA for all human accounts.
- Use SSO with centralized identity provider.
- Use short-lived role assumption (OIDC/STS-vended credentials) for automation and humans.
- Separate role classes: Runtime, CI/deploy, Admin/ops, Security/audit.
- Require explicit role boundaries and permission boundaries.

### Implementation

**AWS SSO (Identity Center):**
- Permission sets: `AdministratorAccess` (founder only), `DeveloperAccess` (engineers, dev account only).
- Engineers never get prod access directly — only CI/CD deploys to prod.
- `aws sso login --profile seedling-dev` for local CLI access.
- Sessions expire after 8 hours — no permanent credentials on laptops.

**CI/CD authentication (GitHub OIDC):**

```
GitHub Actions
  → OIDC token (short-lived, scoped to repo + branch)
  → AWS IAM Role (trusts only this repo)
  → Temporary credentials (30 min expiry)
  → Deploy to Lambda/S3/CloudFront

No long-lived AWS access keys anywhere.
```

```typescript
// GitHub OIDC Identity Provider (infra/cdk/lib/ci-cd-stack.ts)
const oidcProvider = new iam.OpenIdConnectProvider(this, 'GitHubOIDC', {
  url: 'https://token.actions.githubusercontent.com',
  clientIds: ['sts.amazonaws.com'],
});

const deployRole = new iam.Role(this, 'GitHubDeployRole', {
  assumedBy: new iam.FederatedPrincipal(
    oidcProvider.openIdConnectProviderArn,
    {
      StringEquals: {
        'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
      },
      StringLike: {
        'token.actions.githubusercontent.com:sub':
          'repo:TMShumway/Seedling-HQ:ref:refs/heads/main',
      },
    },
    'sts:AssumeRoleWithWebIdentity'
  ),
  maxSessionDuration: Duration.minutes(30),
});
```

Only `TMShumway/Seedling-HQ` repo, `main` branch, can assume the deploy role. A compromised GitHub token from a PR branch cannot deploy to prod.

### Prohibited patterns
- Long-lived access keys.
- Shared admin accounts.
- Broad wildcard IAM permissions on sensitive services.

### Checks and balances
- Two-person approval for IAM policy changes.
- Quarterly access review for all elevated roles.
- Automatic disablement of dormant privileged accounts.

---

## 2) Secrets and Key Management

### Policy controls
- Store secrets only in Secrets Manager/SSM with KMS encryption.
- Rotate secrets on schedule and on incident.
- Use unique secrets per environment.
- Restrict secret read access to the minimal runtime principal.
- Log and alert on sensitive secret access patterns.

### Implementation

**Secrets Manager (per environment):**

```
seedling/<env>/database
  → host, port, username, password, dbname (used by RDS Proxy + Lambda)

seedling/<env>/auth
  → SECURE_LINK_HMAC_SECRET=<random 64 chars>

seedling/<env>/smtp
  → SMTP_HOST, SMTP_PORT, SMTP_FROM, SMTP_PASSWORD

seedling/<env>/app
  → APP_BASE_URL=https://app.seedlinghq.app (prod)
```

Lambda reads secrets at cold start via Secrets Manager SDK call (cached for the execution environment lifetime). Secrets are never written to disk or logs.

**SSM Parameter Store (non-sensitive config):**

```
/seedling/<env>/s3-bucket-name
/seedling/<env>/sqs-queue-url
/seedling/<env>/cognito-user-pool-id
/seedling/<env>/cognito-client-id
/seedling/<env>/rds-proxy-endpoint
```

These are resource identifiers, not secrets. Keeping them in SSM avoids hardcoding.

**Where secrets NEVER live:**

| Location | Status |
|----------|--------|
| AWS Secrets Manager | Allowed |
| AWS SSM Parameter Store | Allowed (non-sensitive config) |
| GitHub OIDC → IAM Role | Allowed (CI/CD auth) |
| GitHub Secrets | Prohibited (no AWS access keys here) |
| `.env` files | Prohibited (not committed, not used in prod) |
| CDK code | Prohibited (no hardcoded values) |
| Lambda deployment zips | Prohibited (no baked-in secrets) |
| CloudWatch logs | Prohibited (PII/secrets redacted by Pino) |
| Git history | Prohibited (`.gitignore` covers all env files) |

### Prohibited patterns
- Secrets in source code, tickets, chat, logs, or container images.
- Plaintext production secrets in `.env` files.

### Checks and balances
- Secret scanning in pre-commit and CI is blocking.
- Rotation runbook owned by engineering + security.
- Dual-approval on secret policy/rotation configuration changes.
- RDS credential rotation via Secrets Manager (30-day cycle).

---

## 3) Data Protection and Isolation

### Policy controls
- Encrypt data in transit (TLS) and at rest (KMS-backed encryption).
- Enforce tenant-scoped access on all reads/writes.
- Use server-generated, scope-bound, revocable, expiring external tokens.
- Store token hashes only; never store plaintext tokens.
- Redact PII and token-like values in logs.

### Implementation

**Network isolation:**

```
VPC (2 AZs for cost efficiency)
├── Public subnets   — NAT Gateway
├── Private subnets  — Lambda functions, RDS, RDS Proxy
└── Security Groups
    ├── Lambda SG: outbound only (no inbound — invoked by API GW)
    ├── RDS Proxy SG: allow 5432 from Lambda SG only
    └── RDS SG: allow 5432 from RDS Proxy SG only
```

- RDS in private subnet — no public internet access.
- Lambda in private subnet — outbound via NAT Gateway.
- RDS Proxy between Lambda and RDS (connection pooling + IAM auth).
- Security groups are least-privilege (specific port + source SG, not CIDR).
- No ALB needed — API Gateway handles HTTPS termination.

**Encryption:**
- RDS: encryption at rest (AWS-managed KMS key), TLS in transit.
- S3: server-side encryption, TLS in transit.
- SQS: encryption at rest, TLS in transit.
- API Gateway: TLS termination, VPC internal traffic.

### Checks and balances
- Cross-tenant denial tests for every tenant-owned endpoint.
- Secure-link tests for expiry/revocation/scope/tenant-object binding.
- Release gate blocks deployment if these test suites fail.

---

## 4) Infrastructure Stacks

### CDK stack decomposition

| Stack | File | Purpose |
|-------|------|---------|
| Network | `infra/cdk/lib/network-stack.ts` | VPC, subnets, NAT Gateway, security groups |
| Database | `infra/cdk/lib/database-stack.ts` | RDS Postgres + RDS Proxy + Secrets Manager |
| Storage | `infra/cdk/lib/storage-stack.ts` | S3 bucket, SQS queues |
| Auth | `infra/cdk/lib/auth-stack.ts` | Cognito user pool + client |
| API | `infra/cdk/lib/api-stack.ts` | Lambda + API Gateway |
| Web | `infra/cdk/lib/web-stack.ts` | S3 static hosting + CloudFront |
| CI/CD | `infra/cdk/lib/ci-cd-stack.ts` | GitHub OIDC provider + IAM deploy roles |
| Orchestrator | `infra/cdk/bin/app.ts` | Wires all stacks per environment |
| Dev Sandbox | `infra/cdk/lib/dev-sandbox-stack.ts` | Local dev (unchanged) |

### Database stack

- RDS Postgres 17 (matches local Docker version).
- `db.t4g.micro` (dev) / `db.t4g.small` (prod).
- Multi-AZ: off for dev, on for prod.
- Automated backups: 7-day retention.
- Encryption at rest: enabled.
- Credentials in Secrets Manager with automatic rotation (30 days).
- No public accessibility. Deletion protection on for prod.

**RDS Proxy** — Lambda creates a new DB connection on each cold start. Without a proxy, 100 concurrent invocations = 100 connections → exhausts RDS limit. Proxy pools connections: 100 invocations share ~10 connections. IAM authentication (no username/password in Lambda).

### API stack (Lambda + API Gateway)

**Lambda adapter:**
```typescript
// apps/api/src/lambda.ts (production entry point)
import awsLambdaFastify from '@fastify/aws-lambda';
import { buildApp } from './app.js';

const app = await buildApp();
export const handler = awsLambdaFastify(app);
```

**esbuild bundling** — single bundled JS file, ~1-3 MB. CDK handles bundling via `NodejsFunction` construct. `apps/api/src/index.ts` (HTTP server) stays for local dev.

**Security controls:**
- Lambda in VPC private subnet — no direct internet access.
- IAM execution role: least-privilege (S3, SQS, SES, Cognito, Secrets Manager, RDS Proxy).
- No secrets in environment variables — fetched from Secrets Manager at cold start.
- API Gateway handles TLS termination and request throttling.
- Lambda concurrency limit prevents runaway costs.
- Bundled code (esbuild) — no `node_modules`, smaller attack surface.

**Lambda considerations:**
- Cold starts: ~500ms-1s for Node.js. Provisioned concurrency available later if needed.
- Timeout: API Gateway 29-second hard limit. Long-running ops should be async (SQS).

### Web stack (CloudFront + S3)

- S3 bucket: private, block all public access.
- CloudFront Origin Access Control (OAC) — only CloudFront reads the bucket.
- HTTPS only (ACM certificate for `app.seedlinghq.app`).
- CloudFront function for SPA routing: rewrites non-file paths to `/index.html`.
- Cache policy: static assets cached 1 year (content hash), HTML cached 5 minutes.
- Security headers via CloudFront response headers policy (CSP, HSTS, X-Frame-Options).
- API requests proxied: CloudFront behavior `/v1/*` → API Gateway origin.

### Database migrations

Deploy sequence:
1. CDK deploys infrastructure changes (if any).
2. Migration Lambda runs (drizzle-kit push or custom migration).
3. API Lambda updated to new code.
4. CloudFront invalidation for web.

Migrations are forward-only. If a migration breaks, fix-forward. Lambda supports instant rollback to the previous function version.

---

## 5) SDLC and Deployment Security Gates

### Merge requirements (blocking)
- Unit, integration, and e2e tests pass.
- Security regression tests pass (auth bypass, tenant boundary, token scope).
- SAST and dependency vulnerability scan pass.
- IaC security scan and policy checks pass.
- Secret scan pass.

### Build and deploy requirements
- Signed artifacts and provenance attestation.
- Immutable build outputs.
- Environment promotion with approval gates.

### CI pipeline (`.github/workflows/ci.yml`)

Runs on every push/PR to `main`:
- **lint-typecheck** — `pnpm run lint` + `pnpm run typecheck`
- **test-api** — unit + integration tests against Postgres service container
- **test-web** — web unit tests
- **dependency scan** — `pnpm audit`

### Deploy pipeline (dev — `.github/workflows/deploy-dev.yml`)

Auto-deploys on merge to `main` after CI passes:
1. OIDC auth → temporary AWS credentials (30 min).
2. Build web.
3. CDK deploy all stacks.
4. CloudFront invalidation.

### Deploy pipeline (prod — `.github/workflows/deploy-prod.yml`)

Manual trigger only (`workflow_dispatch`):
1. OIDC auth → temporary AWS credentials (30 min).
2. Same build + deploy steps as dev.
3. Requires manual approval in GitHub environment protection.

### GitHub environment protection rules

| Environment | Trigger | Approval | Branch restriction |
|-------------|---------|----------|--------------------|
| Dev | Auto on merge to `main` | None (CI must pass) | `main` |
| Production | Manual (`workflow_dispatch`) | Required reviewer (founder) + 5-min wait | `main` only |

### Pre-commit hook (`.husky/pre-commit`)

```bash
#!/bin/sh
# Block commits containing secrets
if git diff --cached --diff-filter=ACM | grep -iE '(aws_secret|password|private_key|-----BEGIN)'; then
  echo "ERROR: Possible secret detected in staged files"
  exit 1
fi

# Block .env files
if git diff --cached --name-only | grep -E '\.env($|\.)'; then
  echo "ERROR: .env file staged for commit"
  exit 1
fi
```

### Checks and balances
- CODEOWNERS for security-critical paths (auth, IAM, CDK/infra, crypto, secrets).
- No self-approval for security-sensitive pull requests.
- No direct production deploy outside controlled pipeline.

---

## 6) Manual Deploy (Local Machine)

For the founder to ship before CI/CD is fully operational.

### Prerequisites

```bash
aws configure sso   # Configure profiles "seedling-dev" and "seedling-prod"
brew install aws-cdk
cd infra/cdk && pnpm install --ignore-workspace
```

### Deploy script (`scripts/deploy.sh`)

```bash
#!/bin/bash
set -euo pipefail

ENV=${1:?Usage: ./scripts/deploy.sh <dev|prod>}
ACCOUNT_PROFILE="seedling-${ENV}"

# Safety: refuse to deploy uncommitted changes
if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: Uncommitted changes detected. Commit or stash before deploying."
  exit 1
fi

# Safety: prod confirmation
if [[ "$ENV" == "prod" ]]; then
  read -p "Deploy to PRODUCTION? Type 'yes' to confirm: " confirm
  [[ "$confirm" == "yes" ]] || { echo "Aborted."; exit 1; }
fi

aws sso login --profile "$ACCOUNT_PROFILE"
export AWS_PROFILE="$ACCOUNT_PROFILE"

echo "Deploying to $ENV (commit: $(git rev-parse --short HEAD))"

pnpm --filter @seedling/web run build

cd infra/cdk
cdk deploy --all \
  -c env="$ENV" \
  -c gitSha="$(git rev-parse --short HEAD)" \
  --require-approval never \
  --profile "$ACCOUNT_PROFILE"
cd ../..

DISTRIBUTION_ID=$(aws ssm get-parameter \
  --name "/seedling/${ENV}/cloudfront-id" \
  --query 'Parameter.Value' --output text)
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" --paths "/*"

echo "Deploy complete! ($ENV, commit: $(git rev-parse --short HEAD))"
```

**Security controls:**
- `aws sso login` — temporary credentials, 8-hour expiry.
- Prod deploys require typing `yes`.
- Git dirty check: refuses uncommitted changes.
- Deploy tagged with git SHA for traceability.
- No secrets passed as arguments or environment variables.
- CDK handles all infrastructure — no manual AWS console clicks.

---

## 7) Governance and Separation of Duties

### Required controls
- Distinct responsibilities:
  - Developer writes change.
  - Reviewer validates correctness.
  - Security reviewer validates risk.
  - Release approver authorizes deployment.
- Break-glass process with strict controls:
  - Time-boxed emergency access.
  - Full session logging.
  - Mandatory post-incident review.

### Checks and balances
- Two-person rule for:
  - IAM/auth changes.
  - Secrets and key policy changes.
  - Security control exceptions.
- Time-limited exceptions with owner and expiry date.

### GitHub variables (NOT secrets)

Only non-sensitive account IDs stored as GitHub Environment Variables:

```
Dev environment:
  AWS_DEV_ACCOUNT_ID = <dev-account-id>

Production environment:
  AWS_PROD_ACCOUNT_ID = <prod-account-id>
```

Account IDs are not secrets. OIDC role assumption handles authentication.

---

## 8) Monitoring, Detection, and Response

### Required telemetry
- Centralized structured logs with immutable retention.
- Audit logs for: authentication/authorization outcomes, role assumptions, secret reads/updates, sensitive data access.
- Security alerts for: auth failure spikes, privilege escalation attempts, unusual secret access, cross-tenant access attempts.
- CloudTrail: all API calls logged (who did what, when).

### AWS-level checks

| Check | Implementation |
|-------|---------------|
| No long-lived credentials | SSO for humans, OIDC for CI/CD |
| Secrets auto-rotate | Secrets Manager 30-day rotation for RDS |
| Least-privilege IAM | Lambda role: only S3/SQS/SES/Cognito/SecretsManager/RDS Proxy |
| Network isolation | RDS in private subnet, no public access |
| DB connection pooling | RDS Proxy prevents Lambda connection exhaustion |
| Encryption at rest | RDS, S3, SQS all encrypted |
| Encryption in transit | TLS everywhere |
| CloudTrail audit | All API calls logged |
| Lambda concurrency limit | Prevents runaway invocations and costs |

### Response readiness
- Incident runbooks for: credential compromise, token leakage, suspected data exposure.
- Defined severity model and escalation matrix.
- Regular incident simulations.

---

## 9) Continuous Assurance Cadence

- **Weekly:** vulnerability triage and patch prioritization.
- **Monthly:** privileged-access and key-usage review.
- **Quarterly:** threat modeling review and control effectiveness review.
- **Annually:** external penetration test.

---

## 10) Security Controls Matrix

| Control Area | Control | Primary Owner | Evidence | Review Cadence | Blocking Gate |
|---|---|---|---|---|---|
| Identity & access | MFA for all human access | Security + IT | Identity provider MFA policy export | Monthly | Access review required |
| Identity & access | Short-lived credentials only | Platform | IAM/STS config and role session policy | Monthly | CI policy check |
| Identity & access | Least-privilege role boundaries | Platform + Security | IAM policy diff + review record | Quarterly or on change | Two-person approval |
| Secrets | Centralized secret storage (Secrets Manager/SSM) | Platform | Secret inventory and access policy | Monthly | IaC policy check |
| Secrets | Secret rotation | Platform + Security | Rotation schedule and last-run evidence | Monthly | Rotation SLA alert |
| Secrets | Secret scanning in commit and CI | Engineering Enablement | Scan logs from pre-commit and CI | Every PR | Merge blocked on findings |
| Data protection | Encryption at rest and in transit | Platform | TLS config + encryption config snapshots | Quarterly | IaC policy check |
| Data protection | Tenant-scoped access enforcement | API Engineering | Automated cross-tenant denial test results | Every PR + release | Test gate |
| External access | Secure-link token constraints (scope, expiry, revoke, hash) | API Engineering + Security | Integration tests + token model checks | Every PR + release | Test gate |
| SDLC | CODEOWNERS on security-critical files | Engineering + Security | CODEOWNERS file and branch protection | On change | Required reviewers gate |
| SDLC | No self-approval on sensitive changes | Engineering Management | Branch protection settings | Continuous | Merge blocked by policy |
| Deployment | Signed artifacts and provenance | Platform | Artifact signature and provenance attestations | Every deploy | Deploy gate |
| Deployment | OIDC-only CI/CD auth (no long-lived keys) | Platform | IAM role trust policy, GitHub OIDC config | On change | OIDC trust policy |
| Monitoring | Immutable audit log retention | Platform + Security | Logging retention policy and integrity config | Quarterly | Audit readiness check |
| Monitoring | High-risk security alerts (auth, privilege, secret access) | Security Operations | Alert rules + test firing evidence | Monthly | Alert health check |
| Response | Break-glass with post-incident review | Security + Operations | Break-glass log and PIR record | On use + quarterly review | Incident governance gate |
| Governance | Exception register with expiry | Security | Approved exception log with expiry dates | Monthly | No-expired-exception gate |

---

## 11) Implementation Checklist

### Identity and access
- [ ] MFA enforced globally.
- [ ] AWS Organizations + SSO configured (dev + prod accounts).
- [ ] Long-lived keys removed.
- [ ] Role boundaries documented and applied.
- [ ] Privileged role review schedule active.
- [ ] GitHub OIDC provider + deploy roles created.

### Secrets and keys
- [ ] Secrets centralized in Secrets Manager.
- [ ] SSM parameters created for non-sensitive config.
- [ ] Rotation policy implemented and tested (30-day RDS rotation).
- [ ] Secret scanning enforced in pre-commit and CI.
- [ ] Secret access alerts enabled.

### Data and tenancy
- [ ] Encryption in transit and at rest verified.
- [ ] Tenant enforcement tests complete for all core entities.
- [ ] Secure-link token controls verified (hash/expiry/revoke/scope).
- [ ] Redaction policy validated in logs.

### Infrastructure
- [ ] Network stack deployed (VPC, subnets, NAT, SGs).
- [ ] Database stack deployed (RDS + RDS Proxy).
- [ ] Storage stack deployed (S3, SQS).
- [ ] Auth stack deployed (Cognito).
- [ ] API stack deployed (Lambda + API Gateway).
- [ ] Web stack deployed (S3 + CloudFront).
- [ ] Lambda adapter (`apps/api/src/lambda.ts`) created and tested.

### Pipeline and governance
- [ ] CI workflow running (lint, typecheck, tests).
- [ ] Dev auto-deploy workflow running.
- [ ] Prod manual deploy workflow running with approval gate.
- [ ] Manual deploy script (`scripts/deploy.sh`) tested.
- [ ] Security gates are blocking in CI.
- [ ] CODEOWNERS applied to security-critical files.
- [ ] Two-person approval enforced for sensitive changes.
- [ ] GitHub environment protection rules configured.

### Monitoring and response
- [ ] Immutable audit logs configured (CloudTrail + CloudWatch).
- [ ] High-risk alerts configured and tested.
- [ ] Incident runbooks reviewed and accessible.
- [ ] Simulation schedule defined.

---

## 12) Implementation Order

| Step | What | Depends On |
|------|------|-----------|
| 1 | Create AWS account (after Atlas incorporation) | Atlas |
| 2 | Set up AWS Organizations + SSO | AWS account |
| 3 | Add `@fastify/aws-lambda` + create `lambda.ts` entry point | — |
| 4 | Deploy CI/CD stack (OIDC provider + IAM roles) | Step 2 |
| 5 | Deploy Network stack (VPC, subnets, NAT, SGs) | Step 2 |
| 6 | Deploy Database stack (RDS + RDS Proxy) | Step 5 |
| 7 | Deploy Storage stack (S3, SQS) | Step 5 |
| 8 | Deploy Auth stack (Cognito) | Step 5 |
| 9 | Deploy API stack (Lambda + API Gateway) | Steps 3, 6, 7, 8 |
| 10 | Deploy Web stack (S3 + CloudFront) | Step 5 |
| 11 | Create manual deploy script | Steps 9, 10 |
| 12 | Create CI workflow (tests) | — |
| 13 | Create CD workflow (deploy dev) | Step 4 |
| 14 | Create CD workflow (deploy prod) | Step 4 |
| 15 | Add pre-commit secret scanning hook | — |
| 16 | Configure GitHub branch protection + environments | Steps 12-14 |

---

## 13) Files to Create/Modify

| File | Action |
|------|--------|
| `apps/api/src/lambda.ts` | Create — Lambda entry point wrapping Fastify app |
| `apps/api/package.json` | Modify — add `@fastify/aws-lambda` dependency |
| `infra/cdk/lib/network-stack.ts` | Create — VPC, subnets, NAT Gateway, security groups |
| `infra/cdk/lib/database-stack.ts` | Create — RDS Postgres + RDS Proxy + Secrets Manager |
| `infra/cdk/lib/storage-stack.ts` | Create — S3 + SQS (extract from dev-sandbox) |
| `infra/cdk/lib/auth-stack.ts` | Create — Cognito (extract from dev-sandbox) |
| `infra/cdk/lib/api-stack.ts` | Create — Lambda + API Gateway |
| `infra/cdk/lib/web-stack.ts` | Create — S3 static + CloudFront |
| `infra/cdk/lib/ci-cd-stack.ts` | Create — GitHub OIDC + IAM deploy roles |
| `infra/cdk/bin/app.ts` | Create — orchestrate all stacks per environment |
| `scripts/deploy.sh` | Create — manual deploy script with safety checks |
| `.github/workflows/ci.yml` | Create — lint, typecheck, tests on PR/push |
| `.github/workflows/deploy-dev.yml` | Create — auto-deploy dev on merge to main |
| `.github/workflows/deploy-prod.yml` | Create — manual prod deploy with approval |
| `.husky/pre-commit` | Create — secret scanning hook |
| `infra/cdk/lib/dev-sandbox-stack.ts` | Keep unchanged — local dev continues working |

---

## 14) Cost Estimate

### Dev Environment

| Resource | Monthly Cost |
|----------|-------------|
| Lambda (low traffic) | ~$0-5 (free tier) |
| API Gateway | ~$0-3 (free tier) |
| RDS db.t4g.micro (single AZ) | ~$15 |
| RDS Proxy | ~$15 |
| NAT Gateway | ~$32 |
| CloudFront (low traffic) | ~$1 |
| S3 (static + uploads) | ~$1 |
| Secrets Manager (4 secrets) | ~$2 |
| **Total dev** | **~$66-74/mo** |

### Prod Environment (additional)

| Resource | Additional Cost |
|----------|----------------|
| RDS db.t4g.small (Multi-AZ) | +$30 |
| Higher Lambda concurrency | +$5-20 |
| NAT Gateway (more traffic) | +$10 |
| **Total prod** | **~$110-140/mo** |

With AWS Activate credits ($5,000): ~3+ years of dev free, or ~2 years of dev + prod free.

---

## 15) Verification

1. **Local dev unchanged:** `pnpm dev` still works with Docker Compose + LocalStack.
2. **Lambda adapter:** `lambda.ts` exports handler; `index.ts` still runs HTTP server locally.
3. **Manual deploy to dev:** `./scripts/deploy.sh dev` → API responds on API Gateway URL, web loads on CloudFront.
4. **CI pipeline:** Push branch, open PR → lint + typecheck + tests pass.
5. **Auto-deploy dev:** Merge PR to `main` → dev environment updates automatically.
6. **Prod deploy:** Trigger `deploy-prod` workflow → requires approval → deploys to prod.
7. **Secret scan:** Stage a file with `AWS_SECRET` → pre-commit hook blocks commit.
8. **No secrets in GitHub:** GitHub Secrets page is empty (no AWS keys).
9. **Temp credentials:** `aws sts get-caller-identity` after SSO login → temporary session.
10. **Network isolation:** Direct connection to RDS from internet → refused.
11. **OIDC scoping:** Workflow on non-main branch targeting prod → IAM denies assume-role.

---

## 16) Definition of Done for Security-Critical Changes

A security-critical change is done only when:
- Design review completed (including abuse cases).
- Required tests are added and passing.
- Audit logging/alerting coverage is verified.
- Rollback and incident response impact is documented.
- Required approvals are recorded.

## Ownership

- **Engineering:** implementation and operational upkeep.
- **Security:** policy, review, and assurance.
- **Platform/DevOps:** infrastructure controls and enforcement.
