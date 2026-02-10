# S-0042: Quote Expiration + Auto-Follow-Up

**Status:** Post-MVP (not scheduled)
**Priority:** P2 — improves close rate
**Epic:** E-0017 (Quote Enhancements)
**Depends on:** S-0010 (Send quote), S-0023 (Quote follow-up automation)

## Context

Quotes that sit without response are the biggest source of lost revenue for service businesses. The current quote status machine includes "expired" but no story implements automatic expiration or follow-up. Combining expiration deadlines with automated follow-up nudges improves close rates significantly.

## Goal

Auto-expire quotes after a configurable period and send follow-up reminders before expiration to prompt client action.

## Recommended approach

- Add `expires_at` timestamp to quotes (set on send, based on business settings default — e.g., 30 days)
- Expiration settings: configurable default expiry period in business settings (7/14/30/60 days)
- Scheduler job: daily scan for quotes where status=sent AND expires_at <= now -> transition to expired
- Follow-up sequence (builds on S-0023):
  - Day 3 after send: "Just checking in" reminder
  - Day 7: "Your quote expires soon" with urgency
  - Day 14 (or 2 days before expiry): "Last chance" final reminder
  - Sequence is configurable via message templates (S-0038)
- Snooze: client can request more time via the quote link -> extends expires_at
- Re-quote: expired quotes can be "re-sent" (creates new version with fresh expiry)
- Dashboard widget: "Quotes expiring this week" count

## Open questions

- [ ] Should follow-up cadence be configurable per quote or tenant-wide?
- [ ] Include a discount/incentive in the follow-up ("10% off if you approve this week")?
- [ ] Should expired quotes be auto-archived or remain visible?
- [ ] What if the client responds after expiration — auto-reactivate or require owner action?
- [ ] How many follow-ups before the system stops (avoid spam)?
