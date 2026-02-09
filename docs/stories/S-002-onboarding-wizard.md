# S-002: Onboarding Wizard — Business Profile

**Status:** In Progress
**Branch:** `s002-onboarding-wizard`
**Issue:** S-002 — "As an owner, I can set business defaults (hours, service area, duration) and edit later."

---

## Checklist

### Phase 0: Branch + Story File
- [x] Create branch `s002-onboarding-wizard` off `main`
- [x] Create this story file
- [ ] Commit & push

### Phase 1: Domain + DB Schema
- [ ] Create `apps/api/src/domain/entities/business-settings.ts` (DaySchedule, BusinessHours, BusinessSettings interfaces)
- [ ] Add `businessSettings` table to `apps/api/src/infra/db/schema.ts`
- [ ] Add demo business_settings row to `apps/api/src/infra/db/seed.ts`
- [ ] Run `db:push` + `db:seed` to verify
- [ ] Commit & push

### Phase 2: Application Layer
- [ ] Create `apps/api/src/application/ports/business-settings-repository.ts`
- [ ] Create `apps/api/src/application/dto/upsert-business-settings-dto.ts`
- [ ] Create `apps/api/src/application/usecases/upsert-business-settings.ts`
- [ ] Create `apps/api/src/application/usecases/get-business-settings.ts`
- [ ] Commit & push

### Phase 3: Infrastructure + Backend Tests (TDD)
- [ ] Create `apps/api/src/infra/db/repositories/drizzle-business-settings-repository.ts`
- [ ] Create `apps/api/test/unit/business-settings.test.ts` (TDD — write first)
- [ ] Create `apps/api/test/integration/business-settings-routes.test.ts` (TDD — write first)
- [ ] Add cross-tenant tests to `apps/api/test/integration/cross-tenant.test.ts`
- [ ] Add `business_settings` to truncateAll() in `apps/api/test/integration/setup.ts`
- [ ] Run all tests — verify green
- [ ] Commit & push

### Phase 4: HTTP Routes + Wiring
- [ ] Create `apps/api/src/adapters/http/routes/business-settings-routes.ts`
- [ ] Modify `apps/api/src/app.ts` to wire settings routes
- [ ] Run all tests — verify green
- [ ] Commit & push

### Phase 5: Frontend — API Client + UI Components
- [ ] Add business settings types and methods to `apps/web/src/lib/api-client.ts`
- [ ] Create `apps/web/src/lib/defaults.ts`
- [ ] Create `apps/web/src/components/ui/select.tsx`
- [ ] Create `apps/web/src/components/ui/textarea.tsx`
- [ ] Create `apps/web/src/components/ui/checkbox.tsx`
- [ ] Commit & push

### Phase 6: Frontend — Form Components
- [ ] Create `apps/web/src/components/business-settings/BusinessInfoFields.tsx`
- [ ] Create `apps/web/src/components/business-settings/BusinessHoursEditor.tsx`
- [ ] Create `apps/web/src/components/business-settings/ServiceAreaFields.tsx`
- [ ] Create `apps/web/src/components/business-settings/BusinessSettingsForm.tsx`
- [ ] Create `apps/web/src/components/business-settings/OnboardingWizard.tsx`
- [ ] Commit & push

### Phase 7: Frontend — Pages + Routing
- [ ] Create `apps/web/src/pages/OnboardingPage.tsx`
- [ ] Create `apps/web/src/pages/SettingsPage.tsx`
- [ ] Modify `apps/web/src/App.tsx` — add /onboarding and /settings routes
- [ ] Modify `apps/web/src/app-shell/Sidebar.tsx` — activate Settings nav item
- [ ] Modify `apps/web/src/pages/DashboardPage.tsx` — show onboarding CTA or settings summary
- [ ] Commit & push

### Phase 8: E2E Tests
- [ ] Create `e2e/tests/onboarding.spec.ts`
- [ ] Run all tests (unit + integration + E2E) — verify green
- [ ] Commit & push

### Phase 9: Final Polish
- [ ] Update this story file — check off all items, update test counts
- [ ] Update `MEMORY.md` with new patterns/counts
- [ ] Run full test suite + manual smoke test
- [ ] Commit & push

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
