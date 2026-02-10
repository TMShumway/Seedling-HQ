# S-0038: Revenue Reports Dashboard

**Status:** Post-MVP (not scheduled)
**Priority:** P0 — owners need to know if they're making money
**Epic:** E-0014 (Reporting + Analytics)
**Depends on:** S-0017 (Generate invoice), S-0018 (Stripe payments)

---

## Context

S-0019 (Basic AR dashboard) shows outstanding receivables. But business owners need broader revenue visibility — how much they've earned this month, which services generate the most revenue, which clients are most valuable. Without revenue reports, the tool is operationally useful but doesn't help with business decisions.

## Goal

Provide a revenue reporting dashboard with key financial metrics, filterable by date range, service type, and client.

## Recommended approach

- New "Reports" nav item (between Invoices and Settings)
- Revenue overview page with:
  - Total revenue (paid invoices) for selected period
  - Revenue by month chart (bar or line chart, last 12 months)
  - Revenue by service category (pie/donut chart)
  - Top 10 clients by revenue (table)
  - Average invoice value
  - Revenue trend (month-over-month growth percentage)
- Date range picker: preset ranges (this month, last month, this quarter, this year, custom)
- Data source: aggregate queries on `invoices` table (WHERE status = 'paid', GROUP BY period)
- API: `GET /v1/reports/revenue?from=&to=&groupBy=month|category|client`
- Consider server-side aggregation for performance (not fetching all invoices to the client)
- Chart library: Recharts (lightweight, React-native, good for bar/line/pie)

## Open questions

- Should reports include tax/discounts breakdown?
- Real-time or daily snapshot (materialized views)?
- Export to CSV/PDF?
- Compare periods (this month vs. last month, this year vs. last year)?
- Should recurring revenue (MRR) be tracked separately from one-time revenue?
