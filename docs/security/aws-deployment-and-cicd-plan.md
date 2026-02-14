# AWS Deployment Plan — Manual + CI/CD (Security-First)

## Context

SeedlingHQ has a working local dev environment (Docker Compose + LocalStack) and a CDK stack defining Cognito, S3, SQS. No production deployment exists yet. We need:

1. **Manual deploy from local machine** — for the founder to ship quickly before CI/CD is set up
2. **GitHub Actions CI/CD** — automated deploy on merge to `main`
3. **Zero secret leakage** — no keys in code, logs, GitHub, or environment files

**Architecture decisions (user-selected):**
- **API:** AWS Lambda + API Gateway (serverless Fastify via `@fastify/aws-lambda` adapter)
- **Frontend:** CloudFront + S3 (global CDN, cheap, standard for SPAs)
- **Database:** RDS Postgres (managed, automated backups) + RDS Proxy (connection pooling for Lambda)
- **Accounts:** Two AWS accounts via AWS Organizations (dev + prod isolation)
- **NAT:** NAT Gateway ($32/mo) for Lambda VPC internet access
- **Prod deploy:** Manual trigger with approval
- **Secrets:** AWS Secrets Manager (never in .env files, never in GitHub, never in logs)

---

## Security Architecture

### Principle: Secrets Never Leave AWS

```
Where secrets live:
  ✅ AWS Secrets Manager          — database URL, HMAC secrets, API keys
  ✅ AWS Systems Manager (SSM)    — non-sensitive config (bucket names, queue URLs)
  ✅ GitHub OIDC → IAM Role       — CI/CD auth (no long-lived AWS keys)

Where secrets NEVER live:
  ❌ GitHub Secrets               — no AWS access keys stored here
  ❌ .env files                   — not committed, not used in prod
  ❌ CDK code                     — no hardcoded values
  ❌ Lambda deployment zips       — no baked-in secrets
  ❌ CloudWatch logs              — PII/secrets redacted by Pino config
  ❌ Git history                  — .gitignore covers all env files
```

### Authentication Flow (CI/CD)

```
GitHub Actions
  → OIDC token (short-lived, scoped to repo + branch)
  → AWS IAM Role (trusts only this repo)
  → Temporary credentials (30 min expiry)
  → Deploy to Lambda/S3/CloudFront

No long-lived AWS access keys anywhere.
```

### Authentication Flow (Manual Deploy)

```
Developer laptop
  → AWS SSO login (aws sso login --profile seedling-dev)
  → Temporary session credentials (8 hour expiry)
  → Deploy via CDK

No permanent credentials stored locally.
```

---

## Phase 1: AWS Account Foundation

### 1.1 AWS Organizations + SSO

**Why:** Separate dev and prod into different AWS accounts for blast-radius isolation. A compromised dev account can't touch prod.

**Structure:**
```
Root AWS Account (management only — no workloads)
├── Dev Account  — dev environment deploys here
└── Prod Account — production deploys here
```

**AWS SSO (Identity Center):**
- Set up AWS SSO for human access (you + engineers)
- Permission sets: `AdministratorAccess` (you only), `DeveloperAccess` (engineers — limited to dev account)
- Engineers NEVER get prod access directly — only CI/CD deploys to prod
- `aws sso login --profile seedling-dev` for local CLI access
- Sessions expire after 8 hours — no permanent credentials on laptops

### 1.2 Secrets Manager Setup

**Per environment, store in AWS Secrets Manager:**

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

**Lambda reads secrets at cold start** via Secrets Manager SDK call (cached for the lifetime of the execution environment). Secrets are never written to disk or logs.

### 1.3 SSM Parameter Store (Non-Sensitive Config)

```
/seedling/<env>/s3-bucket-name
/seedling/<env>/sqs-queue-url
/seedling/<env>/cognito-user-pool-id
/seedling/<env>/cognito-client-id
/seedling/<env>/rds-proxy-endpoint
```

These are not secrets (resource identifiers) but keeping them in SSM means no hardcoding.

---

## Phase 2: Production CDK Stacks

### 2.1 Refactor CDK into Multiple Stacks

Current: one `DevSandboxStack` does everything.
New: separate stacks for independent lifecycle management.

**Files to create/modify:**

| File | Purpose |
|------|---------|
| `infra/cdk/lib/network-stack.ts` | VPC, subnets, NAT Gateway, security groups |
| `infra/cdk/lib/database-stack.ts` | RDS Postgres + RDS Proxy + Secrets Manager |
| `infra/cdk/lib/storage-stack.ts` | S3 bucket, SQS queues (extracted from existing) |
| `infra/cdk/lib/auth-stack.ts` | Cognito (extracted from existing) |
| `infra/cdk/lib/api-stack.ts` | Lambda function + API Gateway |
| `infra/cdk/lib/web-stack.ts` | S3 static hosting + CloudFront distribution |
| `infra/cdk/lib/ci-cd-stack.ts` | GitHub OIDC provider + IAM deploy roles |
| `infra/cdk/bin/app.ts` | Orchestrates all stacks per environment |
| `infra/cdk/lib/dev-sandbox-stack.ts` | Keep unchanged — local dev continues working |

### 2.2 Network Stack

```
VPC (2 AZs for cost efficiency)
├── Public subnets   — NAT Gateway
├── Private subnets  — Lambda functions, RDS, RDS Proxy
└── Security Groups
    ├── Lambda SG: outbound only (no inbound needed — invoked by API GW)
    ├── RDS Proxy SG: allow 5432 from Lambda SG only
    └── RDS SG: allow 5432 from RDS Proxy SG only
```

**Security controls:**
- RDS is in private subnet — no public internet access
- Lambda runs in private subnet — outbound via NAT Gateway
- RDS Proxy sits between Lambda and RDS (connection pooling + IAM auth)
- Security groups are least-privilege (specific port + source SG, not CIDR)
- No ALB needed — API Gateway handles HTTPS termination

### 2.3 Database Stack

- RDS Postgres 17 (match local Docker version)
- `db.t4g.micro` (dev) / `db.t4g.small` (prod) — starts ~$15/mo
- Multi-AZ: off for dev, on for prod
- Automated backups: 7 days retention
- Encryption at rest: enabled (AWS-managed KMS key)
- **Credentials in Secrets Manager** with automatic rotation (30 days)
- No public accessibility
- Deletion protection: on for prod

**RDS Proxy (critical for Lambda):**
- Lambda creates a new DB connection on each cold start. Without a proxy, 100 concurrent Lambda invocations = 100 DB connections → exhausts RDS connection limit
- RDS Proxy pools connections: 100 Lambda invocations share ~10 DB connections
- IAM authentication: Lambda authenticates to RDS Proxy via IAM role, not username/password
- ~$15/mo for smallest instance

### 2.4 API Stack (Lambda + API Gateway)

**Lambda adapter** — add `@fastify/aws-lambda` to `apps/api`:

```typescript
// apps/api/src/lambda.ts (new entry point)
import awsLambdaFastify from '@fastify/aws-lambda';
import { buildApp } from './app.js'; // existing Fastify app builder

const app = await buildApp();
export const handler = awsLambdaFastify(app);
```

**Bundling** — use esbuild to bundle the API into a single file for Lambda:

```typescript
// infra/cdk/lib/api-stack.ts
const apiFunction = new lambda.Function(this, 'ApiFunction', {
  runtime: lambda.Runtime.NODEJS_24_X,
  handler: 'lambda.handler',
  code: lambda.Code.fromAsset('../apps/api', {
    bundling: {
      image: lambda.Runtime.NODEJS_24_X.bundlingImage,
      command: ['bash', '-c',
        'npx esbuild src/lambda.ts --bundle --platform=node --target=node24 --outfile=/asset-output/lambda.js'
      ],
    },
  }),
  memorySize: 512,          // MB — adjust based on performance
  timeout: Duration.seconds(29), // API Gateway max is 29s
  vpc: props.vpc,
  vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
  securityGroups: [props.lambdaSg],
  environment: {
    NODE_ENV: 'production',
    // Non-sensitive config from SSM (resolved at deploy time)
    S3_BUCKET: props.s3BucketName,
    SQS_MESSAGE_QUEUE_URL: props.sqsQueueUrl,
    COGNITO_USER_POOL_ID: props.cognitoUserPoolId,
    COGNITO_CLIENT_ID: props.cognitoClientId,
    // Secrets fetched at runtime from Secrets Manager (not in env vars)
    SECRETS_ARN: props.secretsArn,
  },
});

// API Gateway
const api = new apigateway.LambdaRestApi(this, 'ApiGateway', {
  handler: apiFunction,
  proxy: true,  // All routes → Lambda
  deployOptions: {
    stageName: props.env,
    throttlingRateLimit: 100,   // requests/sec
    throttlingBurstLimit: 200,
  },
});
```

**Security controls:**
- Lambda runs in VPC private subnet — no direct internet access
- IAM execution role: least-privilege (S3, SQS, SES, Cognito, Secrets Manager, RDS Proxy)
- No secrets in environment variables — fetched from Secrets Manager at cold start
- API Gateway handles TLS termination and request throttling
- Lambda concurrency limit prevents runaway costs
- Code is bundled (esbuild) — no `node_modules` directory, smaller attack surface

**Lambda-specific considerations:**
- Cold starts: ~500ms–1s for Node.js. Provisioned concurrency ($) can eliminate this if needed later.
- Connection pooling: RDS Proxy handles this. Lambda code uses a standard pg connection to the proxy endpoint.
- Timeout: API Gateway has a 29-second hard limit. Long-running operations should be async (SQS).
- `apps/api/src/index.ts` (existing HTTP server entry) stays unchanged for local dev. `lambda.ts` is the production entry point.

### 2.5 Web Stack (CloudFront + S3)

- S3 bucket: private, block all public access
- CloudFront Origin Access Control (OAC) — only CloudFront can read the bucket
- HTTPS only (ACM certificate for `app.seedlinghq.app`)
- CloudFront function for SPA routing: rewrites all non-file paths to `/index.html`
- Cache policy: static assets cached 1 year (content hash in filenames), HTML cached 5 minutes
- Security headers via CloudFront response headers policy (CSP, HSTS, X-Frame-Options)
- API requests proxied: CloudFront behavior `/v1/*` → API Gateway origin

### 2.6 CI/CD Stack (GitHub OIDC)

**This is the key security piece — no AWS keys in GitHub.**

```typescript
// GitHub OIDC Identity Provider
const oidcProvider = new iam.OpenIdConnectProvider(this, 'GitHubOIDC', {
  url: 'https://token.actions.githubusercontent.com',
  clientIds: ['sts.amazonaws.com'],
});

// Deploy role — only this repo, only main branch, can assume it
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

**What this means:**
- Only the `TMShumway/Seedling-HQ` repo can assume the deploy role
- Only the `main` branch can trigger prod deploys
- Credentials are temporary (30 min max)
- No AWS access keys stored anywhere in GitHub
- A compromised GitHub token from a PR branch cannot deploy to prod

---

## Phase 3: Lambda Bundling + Migration Strategy

### 3.1 Fastify Lambda Adapter

New dependency: `@fastify/aws-lambda`

New file: `apps/api/src/lambda.ts` — Lambda entry point that wraps the existing Fastify app.

The existing `apps/api/src/index.ts` continues to work for local dev (HTTP server). Lambda uses a different entry point but the same app/routes/middleware.

### 3.2 esbuild Bundling

Lambda deploys a single bundled JS file (not the entire `node_modules`).

Add esbuild config:
- Entry: `apps/api/src/lambda.ts`
- Platform: `node`
- Target: `node24`
- Bundle: true
- External: `pg-native` (optional native module, not needed)
- Output: single `lambda.js` file (~1-3MB)

CDK handles bundling automatically via `NodejsFunction` construct (uses esbuild internally).

### 3.3 Database Migrations

**Strategy:** Run migrations as a separate Lambda function invoked before the API Lambda is updated.

```
Deploy sequence:
1. CDK deploys infrastructure changes (if any)
2. Migration Lambda runs (drizzle-kit push or custom migration)
3. API Lambda updated to new code
4. CloudFront invalidation for web
```

**Security:** Migration Lambda has the same RDS Proxy access. No separate credentials.

**Rollback:** Drizzle migrations are forward-only. If a migration breaks, fix-forward. Lambda supports instant rollback to the previous function version.

---

## Phase 4: Manual Deploy (Local Machine)

### 4.1 Prerequisites

```bash
# One-time setup
aws configure sso  # Configure SSO profiles "seedling-dev" and "seedling-prod"
brew install aws-cdk
cd infra/cdk && pnpm install --ignore-workspace
```

### 4.2 Deploy Script

File: `scripts/deploy.sh`

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
  read -p "⚠️  Deploy to PRODUCTION? Type 'yes' to confirm: " confirm
  [[ "$confirm" == "yes" ]] || { echo "Aborted."; exit 1; }
fi

# Step 0: Authenticate (temporary credentials)
aws sso login --profile "$ACCOUNT_PROFILE"
export AWS_PROFILE="$ACCOUNT_PROFILE"

echo "Deploying to $ENV (commit: $(git rev-parse --short HEAD))"

# Step 1: Build web
echo "Building web..."
pnpm --filter @seedling/web run build

# Step 2: CDK deploy (handles Lambda bundling, S3 sync, CloudFront, everything)
echo "Running CDK deploy..."
cd infra/cdk
cdk deploy --all \
  -c env="$ENV" \
  -c gitSha="$(git rev-parse --short HEAD)" \
  --require-approval never \
  --profile "$ACCOUNT_PROFILE"
cd ../..

# Step 3: Invalidate CloudFront cache
DISTRIBUTION_ID=$(aws ssm get-parameter \
  --name "/seedling/${ENV}/cloudfront-id" \
  --query 'Parameter.Value' --output text)
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" --paths "/*"

echo "✅ Deploy complete! ($ENV, commit: $(git rev-parse --short HEAD))"
```

### 4.3 Security Controls (Manual Deploy)

- `aws sso login` — temporary credentials, expire in 8 hours
- Prod deploys require typing `yes` to confirm
- Git dirty check: script refuses to deploy uncommitted changes
- Deploy tagged with git SHA — full traceability
- No secrets passed as arguments or environment variables
- CDK handles all infrastructure changes — no manual AWS console clicks

---

## Phase 5: GitHub Actions CI/CD

### 5.1 Workflow: CI (Every Push/PR)

File: `.github/workflows/ci.yml`

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint
      - run: pnpm run typecheck

  test-api:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: fsa
          POSTGRES_PASSWORD: fsa
          POSTGRES_DB: fsa
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U fsa"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @seedling/api run test
      - run: pnpm --filter @seedling/api run test:integration
        env:
          DATABASE_URL: postgresql://fsa:fsa@localhost:5432/fsa

  test-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @seedling/web run test
```

### 5.2 Workflow: Deploy to Dev (Merge to Main)

File: `.github/workflows/deploy-dev.yml`

```yaml
name: Deploy Dev
on:
  push:
    branches: [main]
  # Only deploy if CI passes
needs: [lint-typecheck, test-api, test-web]

permissions:
  id-token: write   # Required for OIDC
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: dev
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile

      - name: Configure AWS credentials (OIDC — no keys)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::${{ vars.AWS_DEV_ACCOUNT_ID }}:role/seedling-github-deploy
          aws-region: us-east-1
          role-session-name: github-deploy-${{ github.sha }}
          role-duration-seconds: 1800

      - name: Build web
        run: pnpm --filter @seedling/web run build

      - name: CDK deploy
        working-directory: infra/cdk
        run: |
          pnpm install --ignore-workspace
          npx cdk deploy --all \
            -c env=dev \
            -c gitSha=${{ github.sha }} \
            --require-approval never

      - name: Invalidate CloudFront
        run: |
          DIST_ID=$(aws ssm get-parameter \
            --name /seedling/dev/cloudfront-id \
            --query 'Parameter.Value' --output text)
          aws cloudfront create-invalidation \
            --distribution-id "$DIST_ID" --paths "/*"
```

### 5.3 Workflow: Deploy to Prod (Manual Trigger + Approval)

File: `.github/workflows/deploy-prod.yml`

```yaml
name: Deploy Prod
on:
  workflow_dispatch:  # Manual trigger only

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production  # Requires manual approval in GitHub
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::${{ vars.AWS_PROD_ACCOUNT_ID }}:role/seedling-github-deploy
          aws-region: us-east-1
          role-session-name: github-deploy-${{ github.sha }}
          role-duration-seconds: 1800

      - name: Build web
        run: pnpm --filter @seedling/web run build

      - name: CDK deploy
        working-directory: infra/cdk
        run: |
          pnpm install --ignore-workspace
          npx cdk deploy --all \
            -c env=prod \
            -c gitSha=${{ github.sha }} \
            --require-approval never

      - name: Invalidate CloudFront
        run: |
          DIST_ID=$(aws ssm get-parameter \
            --name /seedling/prod/cloudfront-id \
            --query 'Parameter.Value' --output text)
          aws cloudfront create-invalidation \
            --distribution-id "$DIST_ID" --paths "/*"
```

### 5.4 GitHub Environment Protection Rules

**Dev environment:**
- Auto-deploy on merge to main (after CI passes)
- No approval required

**Production environment:**
- Manual trigger only (`workflow_dispatch`)
- **Required reviewer: you** — no one else can approve prod deploys
- Wait timer: 5 minutes (time to cancel if triggered accidentally)
- Restricted to `main` branch only

### 5.5 GitHub Variables (NOT Secrets)

Store only non-sensitive account IDs as GitHub Environment Variables (not Secrets):

```
Dev environment:
  AWS_DEV_ACCOUNT_ID = 123456789012

Production environment:
  AWS_PROD_ACCOUNT_ID = 987654321098
```

These are not secrets — account IDs are not sensitive. The OIDC role assumption handles authentication.

---

## Phase 6: Security Checks & Balances

### In Code

| Check | How |
|-------|-----|
| No secrets in git | `.gitignore` covers `.env*`, `*.pem`, `*.key` — pre-commit hook validates |
| No secrets in Lambda bundle | esbuild bundles code only, secrets fetched at runtime |
| No secrets in logs | Pino redaction config strips passwords, tokens, keys |
| Dependency scanning | `pnpm audit` in CI pipeline |

### In Deploy Process

| Check | How |
|-------|-----|
| CI must pass before deploy | GitHub branch protection: require status checks |
| Prod requires human approval | GitHub Environment protection rule |
| Only `main` can deploy to prod | OIDC role trust policy + branch protection |
| Deploy tagged with git SHA | Full traceability from Lambda version → commit |
| Dirty working tree blocked | Manual deploy script refuses uncommitted changes |

### In AWS

| Check | How |
|-------|-----|
| No long-lived credentials | SSO for humans, OIDC for CI/CD |
| Secrets auto-rotate | Secrets Manager 30-day rotation for RDS |
| Least-privilege IAM | Lambda role has only S3/SQS/SES/Cognito/SecretsManager/RDS Proxy access |
| Network isolation | RDS in private subnet, no public access |
| DB connection pooling | RDS Proxy prevents Lambda connection exhaustion |
| Encryption at rest | RDS, S3, SQS all encrypted |
| Encryption in transit | TLS everywhere — API Gateway terminates, VPC internal |
| CloudTrail audit | All API calls logged (who did what, when) |
| Lambda concurrency limit | Prevents runaway invocations and costs |

### Pre-Commit Hook

File: `.husky/pre-commit`

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

---

## Implementation Order

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

## Files to Create/Modify

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

## Verification

1. **Local dev unchanged:** `pnpm dev` still works with Docker Compose + LocalStack
2. **Lambda adapter:** `apps/api/src/lambda.ts` exports handler, `src/index.ts` still runs HTTP server locally
3. **Manual deploy to dev:** `./scripts/deploy.sh dev` → API responds on API Gateway URL, web loads on CloudFront
4. **CI pipeline:** Push a branch, open PR → lint + typecheck + tests run and pass
5. **Auto-deploy dev:** Merge PR to main → dev environment updates automatically
6. **Prod deploy:** Trigger `deploy-prod` workflow → requires your approval → deploys to prod
7. **Secret scan:** Stage a file with `AWS_SECRET` → pre-commit hook blocks commit
8. **No secrets in GitHub:** Verify GitHub Secrets page is empty (no AWS keys)
9. **Temp credentials:** Run `aws sts get-caller-identity` after SSO login → shows temporary session
10. **Network isolation:** Attempt direct connection to RDS from internet → connection refused
11. **OIDC scoping:** Workflow on non-main branch targeting prod → IAM denies assume-role

---

## Cost Estimate

### Dev Environment

| Resource | Monthly Cost |
|----------|-------------|
| Lambda (low traffic) | ~$0–5 (free tier: 1M requests/mo) |
| API Gateway | ~$0–3 (free tier: 1M requests/mo) |
| RDS db.t4g.micro (single AZ) | ~$15 |
| RDS Proxy | ~$15 |
| NAT Gateway | ~$32 |
| CloudFront (low traffic) | ~$1 |
| S3 (static + uploads) | ~$1 |
| Secrets Manager (4 secrets) | ~$2 |
| **Total dev** | **~$66–74/mo** |

### Prod Environment (adds)

| Resource | Additional Cost |
|----------|----------------|
| RDS db.t4g.small (Multi-AZ) | +$30 |
| Higher Lambda concurrency | +$5–20 |
| NAT Gateway (more traffic) | +$10 |
| **Total prod** | **~$110–140/mo** |

### Lambda vs ECS Fargate Cost Comparison

| Traffic Level | Lambda | ECS Fargate |
|--------------|--------|-------------|
| Low (< 1M req/mo) | **~$5** | ~$26 (always running) |
| Medium (1-10M req/mo) | ~$15–50 | ~$26–50 |
| High (10M+ req/mo) | ~$50–200 | **~$50–100** |

Lambda wins at low traffic. ECS wins at sustained high traffic. At your stage, Lambda saves ~$20/mo.

**With AWS Activate credits ($5,000):** ~3+ years of dev free, or ~2 years of dev + prod free.
