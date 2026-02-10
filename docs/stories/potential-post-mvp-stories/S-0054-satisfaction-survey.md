# S-0054: Post-Visit Satisfaction Survey

**Status:** Post-MVP (not scheduled)
**Priority:** P2 — feedback loop for service quality
**Epic:** E-0023 (Reputation Management)
**Depends on:** S-0016 (Job completion), S-0021 (Outbound comms worker)

## Context

Most service businesses rely on word-of-mouth and online reviews but have no systematic way to collect client feedback. A simple post-visit survey ("How did we do? 1-5 stars") provides actionable data on service quality and identifies unhappy clients before they leave a negative public review.

## Goal

Automatically send a satisfaction survey to clients after visit completion and aggregate results for quality monitoring.

## Recommended approach

- Survey trigger: send survey link 24 hours after visit status changes to completed (via scheduler + outbox)
- Survey page: public page (secure link, no login) with:
  - Star rating (1-5)
  - Optional comment text area
  - Optional "Would you recommend us?" (NPS-style: 1-10)
- `survey_responses` table: id, tenant_id, visit_id, client_id, property_id, rating, nps_score (nullable), comment (nullable), submitted_at, created_at
- Secure link: same pattern as Client Hub (S-0020) — token-based, one-time or time-limited
- Results dashboard: average rating, NPS score, trend over time, filter by tech/service/period
- Alert: if rating <= 2, notify owner immediately (email/in-app) — opportunity to recover
- Opt-out: respect client communication preferences; don't send survey for every visit (configurable: every visit, once per month, once per job)

## Open questions

- [ ] Survey frequency: every visit is too much for recurring clients — what's the right cadence?
- [ ] Should the survey include photos of the completed work as context?
- [ ] Anonymous or attributed surveys?
- [ ] Link survey results to technician performance metrics?
- [ ] Can the owner respond to negative feedback directly from the survey result?
