# S-0050: Client Self-Service Booking from Hub

**Status:** Post-MVP (not scheduled)
**Priority:** P2 — reduces phone calls, increases bookings
**Epic:** E-0018 (Enhanced Client Hub)
**Depends on:** S-0006 (Public request form), S-0020 (Client Hub)

## Context

The public request form (S-0006) works for new leads but existing clients shouldn't need to fill out a generic form. From the Client Hub, a client should be able to request additional services with their info pre-filled and property already selected. This reduces friction and phone calls.

## Goal

Allow existing clients to request additional services directly from their Client Hub, with pre-filled context and property selection.

## Recommended approach

- "Request Service" button on Client Hub (prominent placement)
- Pre-filled form: client name, email, phone already known; show property selector (dropdown of their properties)
- Service selection: show the business's service catalog (categories + items from S-0003) — client can check what they want
- Preferred date/time: calendar picker or "ASAP" / "This week" / "Flexible" options
- Notes field for additional context
- Submits as a Request (same entity as S-0006) with source='client_hub' instead of 'public_form'
- Skip honeypot and rate limit (client is authenticated via secure link)
- Owner receives same notification as public requests (S-0007)
- Confirmation page: "Your request has been submitted. We'll get back to you within [business response time]."

## Open questions

- [ ] Should the client see pricing from the service catalog, or is that quote-only?
- [ ] Can clients book directly into available calendar slots (real-time availability), or is this always a request that requires owner confirmation?
- [ ] Recurring service requests: "I'd like weekly mowing starting March" — structured or just a note?
- [ ] Should existing clients bypass the quote step for repeat services they've had before?
- [ ] Upsell: show related services ("Clients who get lawn mowing also get aeration")?
