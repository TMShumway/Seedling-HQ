# S-0041: Job Profitability Reports

**Status:** Post-MVP (not scheduled)
**Priority:** P1 — key business insight
**Epic:** E-0014 (Reporting + Analytics)
**Depends on:** S-0012 (Jobs), S-0017 (Invoices)

---

## Context

Revenue is only half the picture. A $500 landscaping job that takes 8 hours of labor and $200 in materials is less profitable than a $300 mowing job that takes 1 hour. Business owners need to understand which jobs and service types are actually profitable.

## Goal

Provide job-level and service-level profitability analysis comparing revenue against estimated and actual costs.

## Recommended approach

- Profitability section on Reports page:
  - Job profitability table: job name, revenue (invoice amount), estimated labor cost, material cost, gross margin
  - Profitability by service category: which services are most/least profitable?
  - Average margin per visit type
  - Trend: is profitability improving or declining over time?
- Cost inputs (may need new fields):
  - Labor: visit duration (already captured in completion) x tech hourly rate (new field on user or crew)
  - Materials: per-job material cost entry (see S-0059) or estimated from quote line items
- API: `GET /v1/reports/profitability?from=&to=`
- For MVP of this story: use visit duration x a configurable default labor rate; material costs can be manual entry per job
- Gross margin = revenue - labor cost - material cost

## Open questions

- Where does the labor rate come from? Per-tech, per-crew, or tenant-wide default?
- Should travel time be included in labor cost?
- How to handle jobs with multiple visits (aggregate all visit durations)?
- Is estimated vs. actual cost comparison valuable (quote estimate vs. real cost)?
- Should overhead allocation be supported (truck costs, insurance, etc.), or is gross margin sufficient?
