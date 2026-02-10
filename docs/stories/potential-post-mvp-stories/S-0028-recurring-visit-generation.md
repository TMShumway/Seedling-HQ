# S-0028: Recurring Visit Auto-Generation

**Status**: Post-MVP (not scheduled)
**Priority**: P0 — core recurring services functionality
**Epic**: E-0012 (Recurring Services)
**Depends on**: S-0027 (Service agreement entity)

---

## Context

Once a service agreement is active, the system needs to automatically generate visits on the defined schedule. This is the automation that makes recurring services actually recurring — without it, the owner would have to manually create every visit, defeating the purpose of the agreement entity.

---

## Goal

Automatically generate upcoming visits based on active service agreements, with the ability to skip, reschedule, or manually trigger generation.

---

## Recommended approach

### Scheduler job

- EventBridge Scheduler (or cron in local dev) runs a generation job daily
- Job queries all active agreements where `next_visit_date <= now + lookahead_days`
- Configurable lookahead window (default 14 days) — generates visits up to N days in advance
- Each generated visit is linked back to the source agreement via `service_agreement_id` FK on the visit/job

### Generation logic

```
For each active agreement:
  1. Calculate next_visit_date based on frequency + last_generated_date
  2. While next_visit_date <= now + lookahead_days:
     a. Create Visit (and parent Job if job-per-visit model)
     b. Copy line_items, property_id, assigned tech from agreement
     c. Respect preferred_day_of_week and preferred_time
     d. Update agreement.last_generated_date
     e. Write audit event: agreement.visit_generated
  3. Skip generation if agreement is paused or past end_date
  4. Auto-complete agreement if end_date has passed
```

### Tracking fields on service_agreements

- `last_generated_date` — date of the most recently generated visit (prevents duplicates)
- `next_visit_date` — computed or stored for query efficiency

### Idempotency

- Generation must be idempotent: running the job twice on the same day produces no duplicates
- Use `last_generated_date` as the guard — only generate visits after this date
- Wrap generation per-agreement in a transaction with optimistic locking on `last_generated_date`

### Edge cases

- **Paused agreements**: Skip generation entirely; when resumed, recalculate `next_visit_date` from today (do not backfill missed visits)
- **Ended agreements**: Auto-transition to `completed` status when `end_date < today` and no future visits remain
- **Holidays / blackout dates**: Future enhancement — for now, generate as normal and let owner reschedule manually
- **Preferred day conflicts**: If `preferred_day_of_week` falls on a holiday or the tech is unavailable, generate anyway and flag for manual review

### UI

- Agreement detail page "Visits" tab shows upcoming generated visits + past visit history
- "Generate next visit" button for manual one-off generation
- "Skip next visit" action — advances `last_generated_date` without creating a visit, writes audit event
- Visit detail page shows link back to source agreement
- Dashboard: "Upcoming visits" count or calendar view (future)

### API routes

- `POST /v1/service-agreements/:id/generate-visit` — manual trigger for next visit
- `POST /v1/service-agreements/:id/skip-visit` — skip the next scheduled visit
- `GET /v1/service-agreements/:id/visits` — list visits generated from this agreement
- Internal scheduler endpoint (or Lambda handler) for the daily generation job

---

## Open questions (decide when scheduling)

- [ ] Should each recurring visit create a new Job, or should there be a single long-running Job per agreement with many Visits?
- [ ] How far ahead should we generate? Too far = lots of speculative data; too short = no advance planning. Is 14 days right?
- [ ] What happens when a tech is unavailable on the preferred day? Auto-reschedule or flag for manual review?
- [ ] Should the system auto-assign the same tech every time or support rotation?
- [ ] Backfill policy: if the system was down or an agreement was paused, should missed visits be backfilled or just skipped?
- [ ] Should visit generation be synchronous (in the scheduler job) or queue-based (EventBridge -> SQS -> Lambda)?
- [ ] Local dev story: how to test the scheduler without EventBridge? Cron-like job in the API server, or a manual CLI command?

---

## Why P0

Without automated visit generation, service agreements are just static records. This story is what transforms an agreement into actual scheduled work. It is the core automation loop for recurring services and directly enables the recurring invoicing in S-0029.
