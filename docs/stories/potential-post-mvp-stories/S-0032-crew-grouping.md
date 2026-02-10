# S-0032: Crew Grouping + Multi-Tech Visit Assignment

Status: Post-MVP (not scheduled)
Priority: P1 — important for larger teams
Epic: E-0013 (RBAC + Team Management)
Depends on: S-0030 (Role-based permissions), S-0014 (Assign technician)

## Context

S-0014 assigns a single technician to a visit. In reality, field service work often involves crews of 2-4 people working together. A mowing crew has a truck with a driver and 1-2 helpers. The business needs to assign a crew (not just one person) and track who worked each job.

## Goal

Support crew/team grouping and multi-technician assignment to visits for workforce management.

## Recommended approach

- `crews` table: id, tenant_id, name (e.g., "Crew A", "North Team"), lead_user_id (FK → users), active, created_at
- `crew_members` join table: crew_id, user_id (many-to-many)
- Extend visit assignment: currently `assigned_to` (single user_id) → support both individual assignment AND crew assignment (`assigned_crew_id`)
- `visit_attendees` table: visit_id, user_id — records who actually worked the visit (may differ from assignment)
- Calendar/schedule view: show crew name on visits, filter by crew
- Today view: techs see visits assigned to them individually OR to their crew
- Crew management UI: Settings → Teams tab, create/edit crews, assign/remove members
- Crew lead can mark attendance for their crew on visit completion

## Open questions

- Should crew assignment replace or supplement individual assignment?
- How does crew scheduling interact with individual availability/time-off?
- Should crews have a "home base" location for route optimization?
- Labor rate per crew vs per individual for job costing?
- Can a tech be on multiple crews?
