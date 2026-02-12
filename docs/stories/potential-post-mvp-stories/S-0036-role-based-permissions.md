# S-0036: Role-Based Permissions (API + UI Gates)

Status: Post-MVP (not scheduled)
Priority: P0 — required for multi-user businesses
Epic: E-0013 (RBAC + Team Management)
Depends on: S-0014 (Assign technician to visit)

## Context

The User entity has roles (owner, admin, member) and Cognito groups are defined (owner, admin, technician), but no story enforces permissions. Currently all authenticated users can access every endpoint and see every page. A 5-20 person business needs role-based access so technicians see only their schedule and job completion, not financials or client PII beyond what's needed for their work.

## Goal

Enforce role-based access control on API endpoints and conditionally render/hide UI sections based on the authenticated user's role.

## Recommended approach

- Define permission matrix:
  - owner: full access to everything
  - admin: full access except tenant deletion, billing settings
  - technician: read own schedule (Today view), complete visits, view assigned job details, view client name/address (not email/phone/financials)
- API middleware: `requireRole(...roles)` Fastify hook that checks `request.principal.role` against allowed roles; returns 403 if unauthorized
- Apply to existing routes: financial endpoints (invoices, AR, quotes pricing), settings, user management → owner/admin only; visit completion, schedule → all roles
- Frontend: `useAuth()` hook exposes `role`; conditional rendering for nav items, action buttons, page access
- Route-level guards: redirect technicians to Today view if they navigate to restricted pages
- Read-only vs read-write: some endpoints may be readable by techs but not writable (e.g., client address for navigation)

## Open questions

- Should technicians see client phone numbers (needed for "I'm running late" calls)?
- Custom roles beyond the three? Or is owner/admin/technician sufficient for MVP?
- Should role changes take effect immediately or require re-login?
- How to handle the transition — existing single-user tenants get owner role automatically
