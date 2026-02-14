# Security and Platform Implementation Strategy

## Status
- Canonical strategy document for security controls, deployment, and CI/CD.
- Reconciles:
  - `docs/security/security-controls-and-assurance-standard.md`
  - `docs/security/aws-deployment-and-cicd-plan.md`

## 1) Compare and Contrast
### What both plans agree on
- No long-lived credentials.
- Secrets must stay out of source control, logs, and CI config.
- Least-privilege IAM and environment isolation are required.
- Security checks must block unsafe releases.
- Production deploys need explicit human approval.

### Where they differ
- `security-controls-and-assurance-standard.md` is a control framework (policy, governance, assurance cadence).
- `aws-deployment-and-cicd-plan.md` is an implementation blueprint (AWS architecture, CDK split, pipeline mechanics).
- One is control-first, one is build-first; neither alone is sufficient.

### Reconciliation decisions
- Keep the control framework as the mandatory policy baseline.
- Use the AWS plan as the delivery mechanism for those controls.
- Enforce one source of truth for execution in this file:
  - controls mapped to concrete platform tasks
  - explicit owners
  - evidence required to mark done
  - release gates tied to CI/CD

## 2) Unified Target State
### Security baseline
- Default deny for network, IAM, and app authorization.
- Short-lived credentials only:
  - humans via AWS SSO
  - CI/CD via GitHub OIDC role assumption
- All secrets in AWS Secrets Manager; non-sensitive runtime config in SSM.
- Full auditability for privileged actions and security-sensitive flows.

### Platform baseline
- API on Lambda + API Gateway.
- Web on S3 + CloudFront (private bucket with OAC).
- Database on RDS Postgres + RDS Proxy.
- Queueing on SQS with DLQ.
- Separate AWS accounts for dev and prod.

### Delivery baseline
- Local dev path remains intact (Docker + LocalStack + current dev sandbox stack).
- Production/staging infrastructure delivered via dedicated CDK stacks.
- Deploys happen through controlled scripts/workflows only, not console click-ops.

## 3) Control-to-Implementation Map
| Control Objective | Technical Implementation | Owner | Evidence |
|---|---|---|---|
| No static AWS keys | AWS SSO for humans, GitHub OIDC for CI/CD | Platform | IAM role trust policy and workflow runs |
| No secret leakage | Secrets Manager + SSM; redaction in app logs; secret scan in CI | Platform + API | CI scan logs and runtime config review |
| Least privilege | Service-specific IAM roles with scoped actions/resources | Platform + Security | IAM policy review record |
| Tenant isolation | Tenant-scoped auth context + query guards + tests | API | Passing tenancy integration tests |
| Secure external access | Scope-bound hashed tokens with expiry/revocation | API + Security | External token tests and audit events |
| Safe releases | Required checks + CODEOWNERS + protected environments | Engineering + Security | Branch protection and GitHub environment rules |
| Traceability | Git SHA on deploy artifacts + CloudTrail + app audit events | Platform + Security | Release metadata and audit logs |

## 4) Phased Execution Plan
## Phase 0: Guardrails First (Week 1)
- Finalize branch protection and CODEOWNERS for security-critical paths.
- Add blocking CI jobs for:
  - tests
  - secret scanning
  - dependency vulnerability scanning
  - IaC policy scanning
- Add security exception register with owner and expiry date.

Exit criteria:
- No direct pushes to `main`.
- No merge allowed when any security check fails.

## Phase 1: Identity, Secrets, and Account Boundaries (Week 1-2)
- Set up AWS Organizations with separate dev/prod accounts.
- Configure AWS SSO profiles for human access.
- Create GitHub OIDC provider and deploy roles per environment.
- Create Secrets Manager secrets and SSM parameters per environment.

Exit criteria:
- CI/CD deploy role assumption works without stored AWS keys.
- Required secrets/config values are retrievable only by approved roles.

## Phase 2: Production CDK Architecture (Week 2-4)
- Introduce dedicated stacks:
  - network
  - database
  - storage
  - auth
  - api
  - web
  - ci-cd
- Keep `infra/cdk/lib/dev-sandbox-stack.ts` for local workflow.
- Add Lambda production entrypoint for Fastify (`apps/api/src/lambda.ts`).

Exit criteria:
- Dev cloud environment deploy succeeds end-to-end through CDK.
- All resources are tagged and least-privilege policies validated.

## Phase 3: Deployment Workflows (Week 3-4)
- Add manual deploy script with:
  - clean git tree check
  - explicit prod confirmation
  - git SHA traceability
- Add GitHub Actions workflows:
  - CI on PR/push
  - auto deploy to dev (after CI)
  - manual approved deploy to prod

Exit criteria:
- Merge to `main` updates dev automatically.
- Prod deploy requires approved manual trigger and succeeds via OIDC.

## Phase 4: Operational Assurance (Week 4+)
- Enable high-risk alerts:
  - auth failures
  - unusual secret access
  - privilege escalation attempts
  - cross-tenant denial anomalies
- Run quarterly access review and threat-model review.
- Run incident simulation for credential/token leak response.

Exit criteria:
- Alerting and runbooks are validated in simulation.
- Security review cadence is running and recorded.

## 5) Checks and Balances (Enforced)
### Change approval rules
- Two-person approval required for IAM, auth, crypto, secrets, and infra changes.
- No self-approval on security-sensitive pull requests.
- Production deployments require environment approval.

### Separation of duties
- Developer authors change.
- Reviewer validates implementation.
- Security reviewer validates control impact.
- Release approver authorizes production rollout.

### Release blocking gates
- Unit/integration/e2e tests pass.
- Tenancy and external-token security tests pass.
- Secret scan pass.
- IaC security checks pass.
- Dependency vulnerability policy pass.

## 6) Immediate Action Backlog (Actionable)
| Priority | Task | Owner | Target |
|---|---|---|---|
| P0 | Add CODEOWNERS and branch protection rules | Engineering | This week |
| P0 | Add blocking CI security jobs | Engineering | This week |
| P0 | Create GitHub OIDC deploy roles in AWS | Platform | This week |
| P1 | Create production CDK app entry and stack split plan PR | Platform | Next week |
| P1 | Add `apps/api/src/lambda.ts` and bundling pipeline | API + Platform | Next week |
| P1 | Add `scripts/deploy.sh` with safety checks | Engineering | Next week |
| P2 | Implement alert set and incident runbooks | Security + Platform | 2-3 weeks |

## 7) Definition of Done for Security-Critical Work
- Threat and abuse cases documented.
- Controls implemented and verified by tests/scans.
- Audit logging and alerting coverage confirmed.
- Rollback path defined.
- Required approvals recorded.

