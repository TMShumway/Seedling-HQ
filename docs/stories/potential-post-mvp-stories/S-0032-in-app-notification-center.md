# S-0032: In-App Notification Center (Post-MVP)

**Status**: Post-MVP (not scheduled)
**Priority**: Low — revisit when 3+ notification types exist (quotes, invoices, visits)
**Depends on**: S-0009 (Quotes), S-0017 (Invoices), S-0021 (SMS worker)

---

## Context

Currently, the business owner is notified of new events via:
- **Email** (S-0007) — outbound notification on new requests
- **Dashboard metric cards** — `New Requests` count badge

This is sufficient while requests are the only actionable event. Once quotes, invoices, visits, and reminders are live, the owner needs a centralized place to see what needs attention without checking each section individually.

---

## Goal

Give the business owner a single in-app view of actionable events and recent activity, with unread tracking so they know what's new since their last visit.

---

## Recommended approach (hybrid)

### A. Dashboard "Recent Activity" card
- New card on the dashboard showing the last 10 events
- Data source: `audit_events` query (already exists)
- Filterable by type (requests, quotes, invoices, etc.)
- "View all" links to dedicated activity page

### B. Sidebar badge counts
- Badge next to nav items showing items needing attention:
  - **Requests** — count of `status=new`
  - **Quotes** — count of `status=pending_approval` (future)
  - **Invoices** — count of `status=unpaid` (future)
- Counts fetched on app load, refreshed on navigation

### C. (Optional) TopBar notification bell
- Bell icon with unread count
- Dropdown showing last 5-10 notifications
- Click-through to the relevant detail page
- Requires a `notifications` table or `last_seen_at` on user to track read/unread state

---

## Open questions (decide when scheduling)

- [ ] Is the dashboard activity card + sidebar badges sufficient, or is a bell icon needed?
- [ ] Should notifications be per-user or per-tenant? (MVP = single owner, so equivalent)
- [ ] Real-time push (WebSocket/SSE) or poll-on-navigate?
- [ ] Which events are "notification-worthy" vs just audit trail?
- [ ] Should in-app notifications link to a dedicated `/notifications` page or just use the dashboard?

---

## Potential data model (if bell icon chosen)

```
notifications
  id              uuid PK
  tenant_id       uuid FK → tenants
  user_id         uuid FK → users
  type            text (e.g., 'new_request', 'quote_approved', 'invoice_paid')
  title           text
  body            text (nullable)
  subject_type    text
  subject_id      uuid
  read_at         timestamptz (nullable)
  created_at      timestamptz
```

Index: `(tenant_id, user_id, read_at, created_at DESC)` for unread-first queries.

---

## Why Post-MVP

- Only one notification type exists today (new request)
- Dashboard count card already surfaces the key metric
- Email notifications cover the "don't miss it" case
- The value increases proportionally with the number of actionable event types
