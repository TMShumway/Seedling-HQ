# S-0036: Invite + Onboard Team Members

Status: Post-MVP (not scheduled)
Priority: P0 — required for multi-user businesses
Epic: E-0013 (RBAC + Team Management)
Depends on: S-0035 (Role-based permissions)

## Context

Currently, only the signup flow creates users (one owner per tenant). There is no way to add additional team members. For a field service business with 5-20 employees, the owner needs to invite technicians and admins to join the tenant.

## Goal

Allow business owners and admins to invite new users to their tenant via email, with role assignment. Invited users create their account and are automatically associated with the correct tenant.

## Recommended approach

- Invite flow: Owner clicks "Invite Member" → enters email + role (admin or technician) → system creates an `invitations` record and sends email with secure invite link
- `invitations` table: id, tenant_id, email, role, token (hashed), status (pending/accepted/expired/revoked), invited_by (user_id), expires_at, created_at
- Invite link: `/invite/:token` → public page that shows tenant name, prompts for name + password → creates Cognito user + DB user record linked to tenant
- Cognito integration: create user in Cognito User Pool, add to appropriate group
- In AUTH_MODE=local: skip Cognito, just create DB user with the token
- UI: Settings page "Team" tab with member list, invite button, revoke invite, change role, deactivate member
- Rate limit invites (prevent spam)
- Email: "You've been invited to join [Business Name] on Seedling HQ"

## Open questions

- Should there be a max team size per plan/tier?
- Can an owner demote another owner? (probably not — single owner per tenant for now)
- What happens to a technician's assigned visits when they're deactivated?
- Should deactivated users be soft-deleted or just locked out?
- Resend invite flow?
