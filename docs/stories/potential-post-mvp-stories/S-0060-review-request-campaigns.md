# S-0060: Automated Review Request Campaigns

**Status:** Post-MVP (not scheduled)
**Priority:** P2 — growth through reputation
**Epic:** E-0023 (Reputation Management)
**Depends on:** S-0059 (Satisfaction survey)

## Context

Clients who give 4-5 star ratings on internal surveys are prime candidates for public reviews on Google, Yelp, or Facebook. Manually asking each happy client to leave a review is tedious. Automating this based on survey results targets the right clients at the right time.

## Goal

Automatically prompt happy clients to leave public reviews on the business's preferred review platforms.

## Recommended approach

- Trigger: when a survey response has rating >= 4 (configurable threshold), queue a follow-up message
- Follow-up message (via outbox/templates): "Thanks for the great rating! Would you mind sharing your experience on Google?" with direct link to the business's Google review page
- Business settings: configure review platform URLs (Google Business Profile, Yelp, Facebook, Angi, etc.), preferred platform for review requests
- Timing: send review request 1-2 days after the positive survey (not immediately — feels less transactional)
- Smart routing: if client already left a Google review recently (manual tracking), suggest a different platform
- Review tracking (manual): mark clients who have left public reviews to avoid repeated asks
  - `review_requests` table: id, tenant_id, client_id, survey_response_id, platform, sent_at, clicked_at (nullable — track link clicks), review_confirmed (boolean, manually toggled by owner)
- Negative feedback gate: clients who give 1-3 stars get a "We're sorry, let us make it right" message instead, never a review request
- Reputation dashboard widget: "Reviews requested this month", "Click-through rate", "Reviews received" (manual count)

## Open questions

- [ ] Google/Yelp policies on soliciting reviews — any restrictions to be aware of?
- [ ] Should the system detect if a review was actually posted (scraping/API), or rely on manual confirmation?
- [ ] Incentives for reviews (e.g., "$10 off your next service") — ethical/legal considerations?
- [ ] Multi-platform: rotate platforms to build reviews across all profiles?
- [ ] Campaign limits: max review requests per client per year?
