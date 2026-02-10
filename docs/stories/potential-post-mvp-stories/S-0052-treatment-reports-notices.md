# S-0052: Treatment Reports + Customer Notices

**Status:** Post-MVP (not scheduled)
**Priority:** P2 — regulatory compliance
**Epic:** E-0019 (Chemical/Treatment Compliance)
**Depends on:** S-0051 (Treatment record logging)

## Context

Many US states require businesses to provide written notice to property owners/occupants within 24 hours of chemical application. This notice must include the product name, active ingredient, application date, and safety precautions. Additionally, businesses need to generate periodic reports for their own records and potential state audits.

## Goal

Generate and deliver customer treatment notices and compliance reports from treatment records.

## Recommended approach

- Customer notice: auto-generated after treatment record is saved
  - PDF or email with: date, property address, product applied, active ingredient, EPA reg number, application rate, precautions/re-entry interval, applicator name + license
  - Delivery: email to client (preferred) or printed notice (flagged for manual delivery)
  - Auto-send toggle in business settings
- Compliance reports:
  - Monthly/quarterly treatment summary: all applications grouped by property, product, and applicator
  - Product usage report: total volume of each product used in a period
  - Applicator log: all treatments by a specific applicator (for license audits)
- Reports accessible from Reports nav section (alongside revenue reports from S-0038)
- Export: PDF and CSV formats for state submission
- Client Hub integration: treatment records visible in service history (S-0049) if the client hub is implemented

## Open questions

- [ ] Which states require notice and in what format? Start with a generic format or state-specific?
- [ ] Should notices be sent automatically or queued for owner review?
- [ ] Pre-entry/re-entry interval tracking (e.g., "Do not enter treated area for 24 hours")?
- [ ] Should the system flag when an applicator's license is expiring?
- [ ] Integration with state regulatory submission systems (API or manual)?
