# S-0002: Onboarding Wizard — Business Profile

**Status:** Complete
**Branch:** `s002-onboarding-profile-wizard`
**Issue:** S-0002 — "As an owner, I can set business defaults (hours, service area, duration) and edit later."

---

## Checklist

### Phase 0: Branch + Story File
- [x] Create branch `s002-onboarding-profile-wizard` off `main`
- [x] Create this story file
- [x] Commit & push

### Phase 1: Domain + DB Schema
- [x] Create `apps/api/src/domain/entities/business-settings.ts` (DaySchedule, BusinessHours, BusinessSettings interfaces)
- [x] Add `businessSettings` table to `apps/api/src/infra/db/schema.ts`
- [x] Seed: intentionally NOT seeded — onboarding flow should prompt configuration
- [x] Run `db:push` + `db:seed` to verify
- [x] Commit & push

### Phase 2: Application Layer
- [x] Create `apps/api/src/application/ports/business-settings-repository.ts`
- [x] Create `apps/api/src/application/dto/upsert-business-settings-dto.ts`
- [x] Create `apps/api/src/application/usecases/upsert-business-settings.ts`
- [x] Create `apps/api/src/application/usecases/get-business-settings.ts`
- [x] Commit & push

### Phase 3: Infrastructure + Backend Tests (TDD)
- [x] Create `apps/api/src/infra/db/repositories/drizzle-business-settings-repository.ts`
- [x] Create `apps/api/test/unit/business-settings.test.ts` (7 unit tests)
- [x] Create `apps/api/test/integration/business-settings-routes.test.ts` (7 integration tests)
- [x] Add cross-tenant tests to `apps/api/test/integration/cross-tenant.test.ts` (2 new tests)
- [x] Add `business_settings` to truncateAll() in `apps/api/test/integration/setup.ts`
- [x] Run all tests — verify green
- [x] Commit & push

### Phase 4: HTTP Routes + Wiring
- [x] Create `apps/api/src/adapters/http/routes/business-settings-routes.ts`
- [x] Modify `apps/api/src/app.ts` to wire settings routes
- [x] Run all tests — verify green
- [x] Commit & push (combined with Phase 3)

### Phase 5: Frontend — API Client + UI Components
- [x] Add business settings types and methods to `apps/web/src/lib/api-client.ts`
- [x] Create `apps/web/src/lib/defaults.ts`
- [x] Create `apps/web/src/components/ui/select.tsx`
- [x] Create `apps/web/src/components/ui/textarea.tsx`
- [x] Create `apps/web/src/components/ui/checkbox.tsx`
- [x] Commit & push

### Phase 6: Frontend — Form Components
- [x] Create `apps/web/src/components/business-settings/BusinessInfoFields.tsx`
- [x] Create `apps/web/src/components/business-settings/BusinessHoursEditor.tsx`
- [x] Create `apps/web/src/components/business-settings/ServiceAreaFields.tsx`
- [x] Create `apps/web/src/components/business-settings/BusinessSettingsForm.tsx`
- [x] Create `apps/web/src/components/business-settings/OnboardingWizard.tsx`
- [x] Commit & push

### Phase 7: Frontend — Pages + Routing
- [x] Create `apps/web/src/pages/OnboardingPage.tsx`
- [x] Create `apps/web/src/pages/SettingsPage.tsx`
- [x] Modify `apps/web/src/App.tsx` — add /onboarding and /settings routes
- [x] Modify `apps/web/src/app-shell/Sidebar.tsx` — activate Settings nav item
- [x] Modify `apps/web/src/pages/DashboardPage.tsx` — show onboarding CTA or settings summary
- [x] Commit & push

### Phase 8: E2E Tests
- [x] Create `e2e/tests/onboarding.spec.ts` (5 tests)
- [x] Add `db:reset` script for clean E2E state
- [x] Update `e2e/global-setup.ts` to run reset → push → seed
- [x] Fix wizard auto-submit (form → div + explicit onClick)
- [x] Run all tests (unit + integration + E2E) — verify green
- [x] Commit & push

### Phase 9: Final Polish
- [x] Update this story file — check off all items, update test counts
- [x] Update `MEMORY.md` with new patterns/counts
- [x] Run full test suite
- [x] Commit & push

---

## Test Counts

| Suite | Count | Notes |
|-------|-------|-------|
| Unit | 27 | 19 from S-0001 + 7 business-settings + 1 auth-override |
| Integration | 16 | 7 tenant + 7 business-settings + 2 cross-tenant (settings) |
| E2E | 18 (15 run, 3 skipped) | 4 signup + 5 onboarding, x2 projects; 3 stateful tests skip on mobile-chrome |
| **Total** | **61** (58 run) | |

### Phase 10: UI Polish
- [x] Add loading skeletons to DashboardPage, SettingsPage, OnboardingPage
- [x] Add sidebar current-page highlighting with `aria-current`
- [x] Add gradient welcome header and onboarding CTA to DashboardPage
- [x] Display all business settings fields on dashboard (phone, address, timezone, duration, service area, description, hours)
- [x] Separate Business Hours into its own card with today highlighting
- [x] Add colored left-border accents and icon badges to dashboard cards
- [x] Change background to warm off-white (`#f8f9fb`), soften card borders/shadows
- [x] Add seedling emoji branding to Sidebar, TopBar, MobileDrawer
- [x] Hide TopBar on desktop (`lg:hidden`) — Sidebar handles branding
- [x] Scroll to top of `<main>` on successful settings save
- [x] Improve success alert visibility (icon + border + shadow)
- [x] Rename "Slug" to "Seedling Business ID" on dashboard
- [x] Create `Skeleton` UI component
- [x] Commit & push

> **Note:** Phase 10 styling was later overhauled by the USWDS-inspired reskin on `experiment` branch:
> dark navy sidebar, deeper color palette (`#1e3a5f` primary, `#f1f5f9` background), tighter radii (2/4/6/8px),
> stronger focus indicators (`ring-2`), plain-text welcome header, and "Seedling HQ" branding.

### Phase 11: Local Auth Override
- [x] Backend: accept `X-Dev-Tenant-Id` / `X-Dev-User-Id` headers in `AUTH_MODE=local` to override env var defaults
- [x] Frontend: store signup response tenant/user IDs in `localStorage`, send as headers on all API requests
- [x] Add unit test for header override behavior
- [x] Commit & push

### Phase 12: PR Feedback Fixes
- [x] Fix: include `settingsQuery.error` in DashboardPage error check (prevents false CTA on API failure)
- [x] Fix: derive audit event name from upsert result timestamps instead of pre-read (eliminates race condition)
- [x] Update unit tests for new audit event derivation logic
- [x] Commit & push

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Table PK | UUID `id` + unique `tenant_id` FK | Consistent with other tables; audit `subjectId` is unambiguous |
| API verb | `PUT /v1/tenants/me/settings` | Idempotent full-replace; settings is a singleton per tenant |
| GET when empty | Return `null` with 200 | Simpler for frontend than 404; distinguishes "not configured" from error |
| No UoW | Settings upsert + audit as separate ops | Single entity write; audit is best-effort, not a data integrity risk |
| Business hours | JSONB column, structured per-day | Enables scheduling logic in future stories while keeping schema simple |
| Timezone | IANA string, validated on frontend | Common US timezones in dropdown; API accepts any string for flexibility |
| Seed data | Business settings NOT seeded | Onboarding flow should prompt user to configure; E2E tests verify this path |
| Wizard layout | `<div>` not `<form>` | `<form>` caused auto-submit when navigating between wizard steps with native inputs |
| Local auth override | `X-Dev-Tenant-Id` / `X-Dev-User-Id` headers | After signup, frontend stores new IDs in localStorage and sends them as headers so the new tenant sees its own data |
| Audit event derivation | Compare `createdAt` vs `updatedAt` from upsert result | Eliminates race condition from pre-read; timestamps within 1s = created, else updated |

---

## Lessons Learned

1. **Wizard steps should not be wrapped in `<form>`** — native inputs (time, number) can trigger implicit form submission when state changes cause re-renders. Use explicit `onClick` handlers instead.
2. **E2E tests need clean DB state** — created `db:reset` script that truncates all tables; global-setup runs reset → push → seed before each E2E run.
3. **Business settings singleton pattern** — upsert with `onConflictDoUpdate` on `tenant_id` unique constraint gives us create-or-update in a single operation.
