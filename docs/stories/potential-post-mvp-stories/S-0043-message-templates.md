# S-0043: Message Templates + Quick-Send

Status: Post-MVP (not scheduled)
Priority: P1 — reduces repetitive typing
Epic: E-0016 (Communication Enhancements)
Depends on: S-0021 (Outbound comms worker)

Context: Field service businesses send the same types of messages repeatedly — appointment confirmations, reschedule notices, payment reminders, seasonal promos. Currently, outbound messages are system-generated (notifications, reminders). Giving owners editable templates with variable substitution saves time and ensures consistent communication.

Goal: Allow business owners to create, edit, and use message templates for common communications, with variable placeholders that auto-fill from context.

Recommended approach:
- `message_templates` table: id, tenant_id, name (e.g., "Appointment Confirmation"), channel (email/sms/both), subject (email only), body (with {{variable}} placeholders), category (appointment, payment, marketing, custom), active, created_at, updated_at
- Seed default templates on tenant creation (appointment confirmation, reschedule notice, payment reminder, thank you)
- Variable system: {{client.firstName}}, {{client.lastName}}, {{property.address}}, {{visit.date}}, {{visit.time}}, {{business.name}}, {{business.phone}}, {{invoice.amount}}, {{invoice.link}}
- Template management UI: Settings → Templates tab, CRUD for templates, preview with sample data
- Quick-send: from a client detail, visit detail, or invoice detail page, click "Send Message" → pick template → preview with variables filled → send
- Templates feed into the existing message outbox (S-0021) for delivery

Open questions:
- Should templates support rich HTML (email) and plain text (SMS) variants?
- Character count limit for SMS templates (160 char segments)?
- Can techs use templates or only owners/admins?
- Template versioning (track changes over time)?
- Approval workflow for templates (owner must approve before techs can use)?
