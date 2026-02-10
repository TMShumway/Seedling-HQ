# S-0049: Service History + Document Access

**Status:** Post-MVP (not scheduled)
**Priority:** P2 — enhances client self-service
**Epic:** E-0018 (Enhanced Client Hub)
**Depends on:** S-0020 (Client Hub)

## Context

The Client Hub (S-0020) lets clients view upcoming appointments and pay invoices. But clients also want to look back — "What work was done last spring? How much did I spend last year? Where's my warranty info?" A service history view answers these questions without the client needing to call the office.

## Goal

Provide a comprehensive service history and document access section in the Client Hub so clients can self-serve on past work details.

## Recommended approach

- Service History tab on Client Hub:
  - Chronological list of completed visits: date, service description, tech name, duration, notes
  - Click to expand: full visit details, line items, photos (if S-0048 done)
  - Filter by property (if client has multiple), date range, service type
  - Summary stats: "12 visits this year", "Total spent: $4,800"
- Documents section:
  - List of past quotes (approved) and invoices (paid + outstanding)
  - Click to view/download as PDF
  - Service agreements (if S-0032 done) with current status
- Invoice payment history: date paid, amount, payment method
- Year-end summary: annual spending summary for tax purposes

## Open questions

- [ ] How far back should history go? All time or configurable?
- [ ] PDF generation: server-side (Puppeteer/wkhtmltopdf) or client-side (jsPDF)?
- [ ] Should chemical treatment records (S-0051) appear here for compliance?
- [ ] Can clients export their data (GDPR-style data portability)?
- [ ] Should there be a "notes to my service provider" section (client -> owner messaging)?
