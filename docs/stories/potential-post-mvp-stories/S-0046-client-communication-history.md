# S-0046: Client Communication History

Status: Post-MVP (not scheduled)
Priority: P1 — provides full context for client interactions
Epic: E-0016 (Communication Enhancements)
Depends on: S-0021 (Outbound comms worker)

Context: The message_outbox table records all outbound messages but there is no UI to view them in context. When a client calls with a question, the owner needs to quickly see: "What messages have we sent this client? Did they receive the appointment reminder? Was the quote follow-up sent?" The Activity tab on client detail shows audit events but not communication history.

Goal: Show a chronological communication history for each client, including all outbound messages (email + SMS), their delivery status, and content.

Recommended approach:
- New "Messages" tab on the client detail page (alongside Info / Properties / Activity)
- Query message_outbox by recipient (client email or phone) filtered by tenant_id
- Display: timestamp, channel (email/SMS icon), subject/preview, status (sent/delivered/failed/queued), click to expand full content
- Filter by channel (all / email / SMS) and status
- Link messages to context: "Re: Appointment on Jan 15" → click through to the visit
- Include system-generated messages (notifications, reminders) and manual sends (quick-send from S-0044)
- Future: two-way SMS — show inbound replies inline (requires Twilio webhook integration, defer to later)

Open questions:
- Should communication history be per-client or per-property (some properties have different contacts)?
- Include internal notes/comments alongside messages (unified activity stream)?
- How to handle messages sent to the same email/phone across different clients (edge case)?
- Should failed messages have a "retry" button?
- Privacy: should techs see full message history or just their own visits' messages?
