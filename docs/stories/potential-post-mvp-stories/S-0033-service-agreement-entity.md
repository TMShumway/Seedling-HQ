# S-0033: Service Agreement Entity + CRUD

**Status**: Post-MVP (not scheduled)
**Priority**: P0 — critical for recurring revenue model
**Epic**: E-0012 (Recurring Services)
**Depends on**: S-0009 (Quote builder), S-0012 (Jobs)

---

## Context

The entire current model is one-shot (Request -> Quote -> Job -> Visit -> Invoice). Lawn care and landscaping businesses live on recurring contracts — weekly mowing, biweekly maintenance, seasonal treatments. A ServiceAgreement entity bridges the gap between an approved quote and automatically generated recurring work.

---

## Goal

Allow business owners to create, view, edit, and manage recurring service agreements for clients. An agreement defines what services are performed, at what frequency, for which property, during what date range, and at what price.

---

## Recommended approach

### Data model

New `service_agreements` table:

```
service_agreements
  id                    uuid PK
  tenant_id             uuid FK -> tenants
  client_id             uuid FK -> clients
  property_id           uuid FK -> properties
  quote_id              uuid FK -> quotes (nullable — can be created standalone)
  status                text (draft/active/paused/completed/cancelled)
  title                 text
  frequency             text (weekly/biweekly/monthly/quarterly/seasonal/custom)
  frequency_interval    integer (nullable — for custom frequency)
  start_date            date
  end_date              date (nullable — null for ongoing agreements)
  preferred_day_of_week integer (nullable — 0=Sunday through 6=Saturday)
  preferred_time        time (nullable)
  line_items            jsonb (same structure as quote line_items)
  total_amount_cents    integer
  notes                 text (nullable)
  created_at            timestamptz
  updated_at            timestamptz
```

Index: `(tenant_id, status, created_at DESC)` for filtered listing queries.

### Status machine

```
draft -> active -> paused <-> active -> completed
                                     -> cancelled
```

- `draft`: Agreement is being configured, not yet active
- `active`: Visits are being generated on schedule
- `paused`: Temporarily suspended (e.g., winter pause); can resume to `active`
- `completed`: End date reached or manually completed
- `cancelled`: Terminated early; no further visits generated

### API routes

- `GET /v1/service-agreements` — list with pagination, status filter, search
- `POST /v1/service-agreements` — create new agreement
- `GET /v1/service-agreements/:id` — get agreement detail
- `PUT /v1/service-agreements/:id` — update agreement
- `DELETE /v1/service-agreements/:id` — soft delete (or cancel)
- `GET /v1/clients/:clientId/service-agreements` — nested listing for client detail
- `POST /v1/service-agreements/:id/activate` — transition draft -> active
- `POST /v1/service-agreements/:id/pause` — transition active -> paused
- `POST /v1/service-agreements/:id/resume` — transition paused -> active
- `POST /v1/service-agreements/:id/cancel` — transition to cancelled

### Create from approved quote

Optional "Convert to recurring" button on quote or job detail page. Pre-fills line items, client, property, and price from the source quote.

### UI

- Agreement list page with status filter tabs
- Agreement detail page with tabs: Info / Visits / Billing History
- Create/edit form with service catalog line item selection
- Agreement section on client detail page (new tab or within existing tabs)

---

## Open questions (decide when scheduling)

- [ ] Should agreements auto-create from approved quotes, or always be manual?
- [ ] How does pricing work for seasonal changes (e.g., mowing price differs spring vs. fall)?
- [ ] Should there be an approval flow (client signs agreement via secure link) or is it internal-only?
- [ ] Pro-rating for mid-cycle starts?
- [ ] Should `line_items` support per-visit overrides (e.g., spring cleanup is different from weekly mow)?
- [ ] Renewal flow: auto-renew with notification, or require manual renewal?

---

## Why P0

Recurring service agreements are the foundation of the entire Recurring Services epic. Without this entity, visit generation (S-0034) and recurring invoicing (S-0035) have nothing to drive them. Most lawn care and landscaping revenue comes from recurring contracts, making this the highest-priority post-MVP feature.
