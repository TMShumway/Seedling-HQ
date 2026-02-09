# Branch Naming Strategy

_Last updated: 2026-02-09_

> Purpose: Define a consistent branch naming convention for Seedling-HQ development.

---

## Prefix categories

| Prefix | Use for | Example |
|--------|---------|---------|
| `story/` | Story implementation (vertical slices) | `story/S-004-client-management` |
| `feature/` | Non-story feature work | `feature/add-dark-mode` |
| `devex/` | Developer experience, docs, tooling, CI | `devex/documentation-improvements` |
| `fix/` | Bug fixes (non-urgent) | `fix/signup-slug-race` |
| `hotfix/` | Urgent production patches | `hotfix/tenant-isolation-leak` |
| `experimental/` | Spikes, prototypes, proof-of-concept | `experimental/swap-express-for-fastify` |

---

## Rules

1. **All lowercase, kebab-case** after the prefix slash
2. **Story branches** include the story ID with zero-padded number: `story/S-XXX-short-description`
3. **Keep descriptions concise** (2-4 words)
4. **No underscores, no camelCase, no ALL-CAPS** in the description portion
5. **Base all branches off `main`** unless explicitly stacking on another branch
6. **Delete branches after merge** to keep the remote clean

---

## Format

```
<prefix>/<description>
```

### Story branches

```
story/S-<number>-<kebab-description>
```

Examples:
- `story/S-004-client-properties`
- `story/S-010-secure-quote-link`
- `story/S-021-outbox-worker`

### All other branches

```
<prefix>/<kebab-description>
```

Examples:
- `feature/calendar-component`
- `devex/ci-pipeline-setup`
- `fix/cross-tenant-settings-leak`
- `hotfix/auth-bypass-patch`
- `experimental/rls-tenancy`

---

## PR workflow

1. Create branch from `main` using the appropriate prefix
2. Implement changes with incremental commits
3. Push and open a PR targeting `main`
4. PR title should be concise (<70 chars); use the description/body for details
5. After merge, delete the branch (GitHub auto-delete is recommended)

---

## Retroactive mapping

Existing branches predate this convention. For reference, here is how they map:

| Existing branch | Convention equivalent |
|----------------|----------------------|
| `S001-business-signup-and-tenancy` | `story/S-001-business-signup` |
| `s002-onboarding-profile-wizard` | `story/S-002-onboarding-wizard` |
| `S003-service-catalog-price-book-v1` | `story/S-003-service-catalog` |
| `feature/aws-lambda-init` | `feature/aws-lambda-init` (already correct) |
| `experimental/swap-express-for-fastify` | `experimental/swap-express-for-fastify` (already correct) |
| `monorepo-setup` | `devex/monorepo-setup` |
| `devex-cleanup-docs` | `devex/cleanup-docs` |

> Note: Existing branches will not be renamed. This convention applies to all new branches going forward.
