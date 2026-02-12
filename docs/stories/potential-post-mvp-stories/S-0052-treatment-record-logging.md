# S-0052: Treatment Record Logging

**Status:** Post-MVP (not scheduled)
**Priority:** P2 — legal compliance for lawn care/pest control
**Epic:** E-0019 (Chemical/Treatment Compliance)
**Depends on:** S-0016 (Job completion)

## Context

Lawn care businesses applying fertilizers, herbicides, or pesticides are legally required in most US states to record what was applied, when, where, at what rate, and by whom. Failure to maintain these records can result in fines and license revocation. Competitors like Real Green treat this as a core module.

## Goal

Allow technicians to log chemical/treatment applications during visit completion, creating a compliance-ready record tied to the property and visit.

## Recommended approach

- `treatment_records` table: id, tenant_id, visit_id, property_id, product_name, epa_registration_number (nullable), active_ingredient, application_rate, application_rate_unit (oz/1000sqft, lbs/acre, etc.), area_treated_sqft, total_product_used, wind_speed (nullable), temperature (nullable), applicator_user_id, applicator_license_number, notes, created_at
- `products` lookup table (optional): id, tenant_id, product_name, epa_reg_number, active_ingredient, default_rate, default_unit — pre-fill common products
- Visit completion form extension: after marking a visit complete, optional "Log Treatment" step for applicable service types
- Treatment log view: accessible from visit detail, property detail, and dedicated "Treatments" report
- Per-property treatment history: chronological list of all treatments applied, filterable by product/date

## Open questions

- [ ] Should treatment logging be optional or required based on service type?
- [ ] State-specific compliance formats (e.g., some states require specific PDF report formats)?
- [ ] Should the product lookup table be pre-seeded with common lawn care products?
- [ ] Integration with weather data (S-0056) for wind/temperature auto-fill?
- [ ] Customer notice generation (see S-0053) — required in many states within 24 hours of application
