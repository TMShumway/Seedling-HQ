# Security Controls and Assurance Standard

## Purpose
Define a practical, high-assurance security model that minimizes leakage risk (information, access, keys, secrets), enforces checks and balances, and supports fast detection and containment.

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

## 1) Identity and Access Control
### Required controls
- Enforce MFA for all human accounts.
- Use SSO with centralized identity provider.
- Use short-lived role assumption (OIDC/STSvended credentials) for automation and humans.
- Separate role classes:
  - Runtime roles
  - CI/deploy roles
  - Admin/ops roles
  - Security/audit roles
- Require explicit role boundaries and permission boundaries.

### Prohibited patterns
- Long-lived access keys.
- Shared admin accounts.
- Broad wildcard IAM permissions on sensitive services.

### Checks and balances
- Two-person approval for IAM policy changes.
- Quarterly access review for all elevated roles.
- Automatic disablement of dormant privileged accounts.

## 2) Secrets and Key Management
### Required controls
- Store secrets only in Secrets Manager/SSM with KMS encryption.
- Rotate secrets on schedule and on incident.
- Use unique secrets per environment.
- Restrict secret read access to the minimal runtime principal.
- Log and alert on sensitive secret access patterns.

### Prohibited patterns
- Secrets in source code, tickets, chat, logs, or container images.
- Plaintext production secrets in `.env` files.

### Checks and balances
- Secret scanning in pre-commit and CI is blocking.
- Rotation runbook owned by engineering + security.
- Dual-approval on secret policy/rotation configuration changes.

## 3) Data Protection and Isolation
### Required controls
- Encrypt data in transit (TLS) and at rest (KMS-backed encryption).
- Enforce tenant-scoped access on all reads/writes.
- Use server-generated, scope-bound, revocable, expiring external tokens.
- Store token hashes only; never store plaintext tokens.
- Redact PII and token-like values in logs.

### Checks and balances
- Cross-tenant denial tests for every tenant-owned endpoint.
- Secure-link tests for expiry/revocation/scope/tenant-object binding.
- Release gate blocks deployment if these test suites fail.

## 4) SDLC and Deployment Security Gates
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

### Checks and balances
- CODEOWNERS for security-critical paths (auth, IAM, CDK/infra, crypto, secrets).
- No self-approval for security-sensitive pull requests.
- No direct production deploy outside controlled pipeline.

## 5) Governance and Separation of Duties
### Required controls
- Distinct responsibilities:
  - Developer writes change.
  - Reviewer validates correctness.
  - Security reviewer validates risk.
  - Release approver authorizes deployment.
- Break-glass process with strict controls:
  - Time-boxed emergency access
  - Full session logging
  - Mandatory post-incident review

### Checks and balances
- Two-person rule for:
  - IAM/auth changes
  - Secrets and key policy changes
  - Security control exceptions
- Time-limited exceptions with owner and expiry date.

## 6) Monitoring, Detection, and Response
### Required telemetry
- Centralized structured logs with immutable retention.
- Audit logs for:
  - Authentication and authorization outcomes
  - Role assumptions
  - Secret reads/updates
  - Sensitive data access
- Security alerts for:
  - Auth failure spikes
  - Privilege escalation attempts
  - Unusual secret access
  - Cross-tenant access attempts

### Response readiness
- Incident runbooks for:
  - Credential compromise
  - Token leakage
  - Suspected data exposure
- Defined severity model and escalation matrix.
- Regular incident simulations.

## 7) Continuous Assurance Cadence
- Weekly: vulnerability triage and patch prioritization.
- Monthly: privileged-access and key-usage review.
- Quarterly: threat modeling review and control effectiveness review.
- Annually: external penetration test.

## 8) Implementation Checklist
Use this as the execution tracker.

### Identity and access
- [ ] MFA enforced globally.
- [ ] Long-lived keys removed.
- [ ] Role boundaries documented and applied.
- [ ] Privileged role review schedule active.

### Secrets and keys
- [ ] Secrets centralized in managed store.
- [ ] Rotation policy implemented and tested.
- [ ] Secret scanning enforced in pre-commit and CI.
- [ ] Secret access alerts enabled.

### Data and tenancy
- [ ] Encryption in transit and at rest verified.
- [ ] Tenant enforcement tests complete for all core entities.
- [ ] Secure-link token controls verified (hash/expiry/revoke/scope).
- [ ] Redaction policy validated in logs.

### Pipeline and governance
- [ ] Security gates are blocking in CI.
- [ ] CODEOWNERS applied to security-critical files.
- [ ] Two-person approval enforced for sensitive changes.
- [ ] Production deploy separation of duties enforced.

### Monitoring and response
- [ ] Immutable audit logs configured.
- [ ] High-risk alerts configured and tested.
- [ ] Incident runbooks reviewed and accessible.
- [ ] Simulation schedule defined.

## 9) Security Controls Matrix
Use this matrix as the source of truth for control ownership, proof of implementation, review cadence, and blocking gates.

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
| Monitoring | Immutable audit log retention | Platform + Security | Logging retention policy and integrity config | Quarterly | Audit readiness check |
| Monitoring | High-risk security alerts (auth, privilege, secret access) | Security Operations | Alert rules + test firing evidence | Monthly | Alert health check |
| Response | Break-glass with post-incident review | Security + Operations | Break-glass log and PIR record | On use + quarterly review | Incident governance gate |
| Governance | Exception register with expiry | Security | Approved exception log with expiry dates | Monthly | No-expired-exception gate |

## 10) Definition of Done for Security-Critical Changes
A security-critical change is done only when:
- Design review completed (including abuse cases).
- Required tests are added and passing.
- Audit logging/alerting coverage is verified.
- Rollback and incident response impact is documented.
- Required approvals are recorded.

## 11) Ownership
- Engineering: implementation and operational upkeep.
- Security: policy, review, and assurance.
- Platform/DevOps: infrastructure controls and enforcement.
