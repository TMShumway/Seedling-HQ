# S-0058: Equipment Inventory + Maintenance Tracking

**Status:** Post-MVP (not scheduled)
**Priority:** P2 — asset management for growing businesses
**Epic:** E-0022 (Equipment + Inventory)
**Depends on:** none (standalone)

## Context

A landscaping business with 3-5 trucks, multiple mowers, trimmers, blowers, and trailers needs to track where equipment is, when it was last maintained, and when maintenance is due. Equipment breakdowns cause missed appointments and lost revenue. Preventive maintenance tracking is a basic operational need.

## Goal

Track equipment inventory with assignment to crews/trucks and maintenance schedules with reminders.

## Recommended approach

- `equipment` table: id, tenant_id, name, type (mower, trimmer, truck, trailer, other), make, model, serial_number, purchase_date, purchase_cost_cents, assigned_crew_id (nullable), assigned_user_id (nullable), status (active/maintenance/retired), notes, created_at, updated_at
- `maintenance_records` table: id, equipment_id, tenant_id, type (scheduled/unscheduled/repair), description, performed_by, cost_cents, performed_at, next_due_at (nullable), next_due_hours (nullable — for hour-meter equipment)
- Equipment list page: inventory table with filters by type, status, assignment
- Equipment detail page: info, maintenance history, upcoming maintenance
- Maintenance reminders: daily check for equipment where next_due_at <= now + 7 days, create notification
- Dashboard widget: "Equipment maintenance due" count
- Assign to crew: drag/drop or dropdown to assign equipment to crews (S-0038)

## Open questions

- [ ] Track equipment hours (mower hour meters) or just calendar-based maintenance?
- [ ] GPS tracking integration for trucks/trailers (hardware dependency)?
- [ ] Depreciation tracking for accounting purposes?
- [ ] Equipment checkout/checkin flow (who has the chainsaw today)?
- [ ] Should equipment costs be factored into job profitability (S-0041)?
