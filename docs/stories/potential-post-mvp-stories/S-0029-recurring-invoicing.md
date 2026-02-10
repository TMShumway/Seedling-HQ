# S-0029: Recurring Invoicing + Billing Cycles

**Status**: Post-MVP (not scheduled)
**Priority**: P0 — monetizes recurring services
**Epic**: E-0012 (Recurring Services)
**Depends on**: S-0027 (Service agreement entity), S-0017 (Generate invoice)

---

## Context

Recurring service clients are typically billed on a cycle (monthly, per-visit, or prepaid seasonal). The current invoice model generates one invoice per completed visit. For recurring clients, the owner may want to batch multiple visits into a single monthly invoice, or bill a flat monthly rate regardless of visit count. This story adds billing mode flexibility to service agreements and automates invoice generation on the billing cycle.

---

## Goal

Support multiple billing modes for recurring service agreements and automate invoice generation on the billing cycle, so the business owner does not have to manually create invoices for recurring work.

---

## Recommended approach

### Billing modes

Add `billing_mode` field to `service_agreements`:

| Mode | Behavior |
|------|----------|
| `per_visit` | Invoice generated after each completed visit (existing S-0017 flow, just linked to agreement) |
| `monthly` | All completed visits in a calendar month batched into a single invoice |
| `flat_rate` | Fixed monthly amount invoiced on cycle date, regardless of visit count |
| `prepaid` | Seasonal or term-based lump sum invoiced upfront |

### Additional fields on service_agreements

```
billing_mode            text (per_visit/monthly/flat_rate/prepaid)
billing_day_of_month    integer (nullable — day of month for monthly/flat_rate billing, default 1)
last_billed_date        date (nullable — tracks last invoice generation to prevent duplicates)
next_billing_date       date (nullable — computed for query efficiency)
```

### Billing cycle scheduler

- Separate scheduler job (or combined with visit generation) runs daily
- Queries agreements where `billing_mode != 'per_visit'` and `next_billing_date <= today`
- Generates invoices per billing mode:

#### per_visit mode
- No scheduler involvement — uses existing S-0017 flow
- Visit completion triggers invoice generation
- Invoice includes `service_agreement_id` for traceability

#### monthly mode
- On billing date, query all completed visits for this agreement since `last_billed_date`
- Aggregate visit line items into a single invoice
- Invoice body lists individual visit dates and services for transparency
- Update `last_billed_date` and compute `next_billing_date`

#### flat_rate mode
- On billing date, generate invoice with agreement's `total_amount_cents`
- Line items reference the agreement, not individual visits
- Visits are tracked for service delivery but do not affect invoice amount

#### prepaid mode
- Single invoice generated when agreement is activated (or on a defined start date)
- Amount = `total_amount_cents` (full term amount)
- Optional: split into installments (future enhancement)

### Idempotency

- Use `last_billed_date` as guard against duplicate invoice generation
- Wrap invoice creation in a transaction with agreement update
- Write audit event: `agreement.invoice_generated`

### Invoice line item traceability

- Invoice line items include `service_agreement_id` reference
- For monthly mode, each line item can reference the specific visit(s) it covers
- Enables "drill down" from invoice to the visits that generated it

### UI

- Agreement detail page "Billing History" tab shows all invoices generated from this agreement
- Next billing date displayed on agreement detail
- Dashboard metric card: "Monthly Recurring Revenue (MRR)" — sum of `total_amount_cents` for all active agreements with monthly/flat_rate billing
- Invoice detail page shows link back to source agreement when applicable

### API routes

- `GET /v1/service-agreements/:id/invoices` — list invoices for an agreement
- `POST /v1/service-agreements/:id/generate-invoice` — manual trigger for next billing cycle
- `GET /v1/dashboard/mrr` — monthly recurring revenue metric
- Internal scheduler endpoint for the daily billing cycle job

---

## Open questions (decide when scheduling)

- [ ] Should prepaid agreements generate a single invoice upfront or split into installments?
- [ ] How to handle partial months (client starts mid-month)? Pro-rate or bill full month?
- [ ] What about price increases? Apply immediately or at next renewal/billing cycle?
- [ ] Credit/refund flow for skipped or cancelled visits on monthly mode?
- [ ] Should the system auto-send invoices (email + secure link) or queue them for owner review first?
- [ ] How does flat_rate mode reconcile with actual visits delivered? Is there a "service delivery report" showing visits vs. billed amount?
- [ ] Should MRR metric include prepaid agreements (amortized monthly) or only monthly/flat_rate?
- [ ] Integration with Stripe (S-0018): should recurring invoices auto-charge saved payment methods?

---

## Why P0

Revenue collection is the end goal of the recurring services workflow. Agreements define the work (S-0027), visit generation schedules it (S-0028), and this story ensures the business gets paid for it. Without automated recurring invoicing, the owner must manually create invoices for every billing cycle, which negates much of the value of the recurring services feature.
