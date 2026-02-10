# S-0056: Rain Delay Bulk Reschedule

**Status:** Post-MVP (not scheduled)
**Priority:** P2 — operational efficiency
**Epic:** E-0021 (Weather Integration)
**Depends on:** S-0055 (Weather on calendar), S-0013 (Calendar)

## Context

When it rains, a landscaping business may need to reschedule 10-20 visits in a single day. Currently, each visit would need to be individually rescheduled. Bulk reschedule triggered by weather conditions (or manual selection) dramatically reduces dispatcher workload on rain days.

## Goal

Allow dispatchers to bulk reschedule visits affected by weather (or other reasons), moving them to the next available day.

## Recommended approach

- "Rain delay" action on calendar day view: select the day, click "Rain Delay" — system shows all scheduled visits for that day
- Bulk select: check individual visits or "Select All" — choose target date (suggest next dry day from forecast)
- Smart reschedule: auto-suggest the next available slot based on tech availability and weather forecast
- Reschedule reasons: rain, snow, extreme heat, equipment breakdown, other (tracked for analytics)
- Notifications: auto-send reschedule notifications to affected clients (uses templates from S-0043)
- Recurring service awareness: if the visit is part of a recurring agreement (S-0032), adjust the cadence or add a makeup visit
- Audit trail: log bulk reschedule action with count and reason

## Open questions

- [ ] Auto-detect rain days from weather data and proactively suggest reschedule, or always manual trigger?
- [ ] What about partial rain days (morning rain, afternoon clear) — reschedule all or just morning visits?
- [ ] Should the system prevent scheduling outdoor visits on forecasted rain days?
- [ ] How to handle crew assignments when rescheduling (same crew or reassign)?
- [ ] Undo: ability to revert a bulk reschedule if the weather clears?
