# S-0044: On-My-Way + Job Completion Auto-Texts

Status: Post-MVP (not scheduled)
Priority: P1 — clients love proactive communication
Epic: E-0016 (Communication Enhancements)
Depends on: S-0015 (Tech Today view), S-0021 (Outbound comms worker)

Context: The #1 complaint clients have about service businesses is "I didn't know when you were coming." An "on my way" text when the tech starts driving and a "job complete" summary when they finish transforms the client experience. These are tied to existing visit status transitions (scheduled → en_route → completed).

Goal: Automatically send SMS/email to the client when a visit transitions to en_route ("on my way") and completed ("job complete"), using configurable templates.

Recommended approach:
- Triggered by visit status transitions (not manual send):
  - `en_route` → send "on my way" template to client
  - `completed` → send "job complete" template to client (with optional photo attachment)
- Use message templates (S-0043) for the content, with visit-specific variables
- Business settings toggle: enable/disable each auto-text type (some owners may not want this)
- Per-client opt-out: `communication_preferences` on client record (sms_opt_in, email_opt_in)
- ETA estimation: if route data available (S-0041), include estimated arrival time in the "on my way" message
- Job completion summary: include services performed, tech name, any notes; optionally attach before/after photos
- Channel priority: SMS preferred (faster), email as fallback if no phone number

Open questions:
- Should the tech see a confirmation before the auto-text sends, or is it fully automatic on status change?
- Include pricing in the completion summary (leads into invoicing), or keep it service-focused?
- What if the client doesn't have a phone number — skip SMS silently or prompt the tech?
- Rate limit: don't send duplicate texts if tech accidentally toggles status back and forth
- Should "on my way" include a map tracking link (like Uber)?
