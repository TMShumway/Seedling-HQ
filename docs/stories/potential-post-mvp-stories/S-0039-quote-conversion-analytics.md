# S-0039: Quote Conversion + Pipeline Analytics

**Status:** Post-MVP (not scheduled)
**Priority:** P1 — helps optimize sales process
**Epic:** E-0014 (Reporting + Analytics)
**Depends on:** S-0009 (Quote builder), S-0011 (Customer approves quote)

---

## Context

Business owners need to understand their sales pipeline efficiency. How many quotes are they sending? What percentage get approved? What's the average time from quote sent to approval? Which service types have the highest win rate? This data helps them refine pricing and follow-up strategy.

## Goal

Provide pipeline analytics showing quote volume, conversion rates, and cycle times.

## Recommended approach

- Pipeline section on the Reports page (or separate tab):
  - Quotes sent vs. approved vs. declined (funnel visualization)
  - Conversion rate: approved / (approved + declined + expired) as percentage
  - Average quote value (sent vs. approved — is there a price sensitivity threshold?)
  - Average time to approval (quote sent -> approved, in days)
  - Win/loss by service category (which services close best?)
  - Quote aging: how many quotes are outstanding > 7/14/30 days?
- Date range filter (same as revenue reports)
- API: `GET /v1/reports/pipeline?from=&to=`
- Data source: aggregate on `quotes` table by status, with date math on status transition timestamps

## Open questions

- Should we track "reasons for decline" (requires a decline reason field on quotes)?
- Is a full sales funnel (request -> quote -> approval -> job) useful, or just quote -> outcome?
- Should pipeline metrics be per-user (who sends the most quotes?) for team performance?
- Alert/notification when conversion rate drops below a threshold?
