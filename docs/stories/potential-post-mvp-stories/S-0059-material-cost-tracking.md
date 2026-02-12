# S-0059: Material Cost Tracking per Job

**Status:** Post-MVP (not scheduled)
**Priority:** P2 — enables job profitability analysis
**Epic:** E-0022 (Equipment + Inventory)
**Depends on:** S-0012 (Jobs)

## Context

Landscaping jobs often involve material costs (mulch, soil, plants, pavers, irrigation parts) in addition to labor. For profitability analysis (S-0041), the business needs to track material costs per job. Currently there's no way to record what materials were used and at what cost.

## Goal

Allow tracking of material costs against jobs for cost analysis and profitability reporting.

## Recommended approach

- `job_materials` table: id, tenant_id, job_id, name, description (nullable), quantity, unit (bags, cubic yards, each, etc.), unit_cost_cents, total_cost_cents (computed: quantity * unit_cost), supplier (nullable), receipt_photo_url (nullable), added_by (user_id), created_at
- Job detail page: "Materials" section with add/edit/remove material line items
- Receipt photo: optional photo upload of receipt (S3 presigned URL, same pattern as visit photos)
- Materials summary on job: total material cost, displayed alongside labor cost for profitability view
- Common materials library (optional): tenant-level `materials` table with common items + default prices, for quick add
- Report integration: material costs feed into job profitability reports (S-0041)
- Visit-level materials (optional): assign materials to specific visits within a job

## Open questions

- [ ] Should material costs be estimated (from quote line items) and actual (entered during/after job)?
- [ ] Inventory tracking: deduct materials from an inventory count, or just track costs?
- [ ] Markup: does the business mark up materials to the client (separate from service labor)?
- [ ] Purchase order workflow: create POs for materials before a job?
- [ ] Integration with supplier catalogs (SRS, SiteOne) for pricing — too complex for now?
