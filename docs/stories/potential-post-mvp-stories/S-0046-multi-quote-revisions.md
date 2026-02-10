# S-0046: Multi-Quote per Request + Revisions

**Status:** Post-MVP (not scheduled)
**Priority:** P1 — common real-world workflow
**Epic:** E-0017 (Quote Enhancements)
**Depends on:** S-0009 (Quote builder)

## Context

The current model supports one quote per request (1:1 via requestId). In practice, clients frequently ask for options ("What would basic cleanup cost vs. full renovation?") or request changes after seeing the initial quote. The owner needs to create multiple quote options and revise existing quotes while maintaining history.

## Goal

Support multiple quote options per request and version history for revised quotes, so owners can present options and iterate without losing previous versions.

## Recommended approach

- Change quote-request relationship from 1:1 to 1:many (requestId already nullable on quotes, just allow multiple quotes with same requestId)
- Quote versioning: add `version` integer and `parent_quote_id` (self-referential FK, nullable) to quotes table
  - Creating a revision: duplicate the quote with incremented version, link to parent
  - Original quote status -> "revised" (new status), new version becomes the active quote
  - Version history visible on quote detail page
- Multi-option quotes: allow creating sibling quotes for the same request with different scopes/prices
  - UI: "Add Option" button on the quote list for a request
  - When sending to client (S-0010), send all active options — client picks one
- Quote comparison view: side-by-side comparison of options for internal review
- Status machine update: add "revised" status (draft -> sent -> revised | approved | declined | expired)

## Open questions

- [ ] Should revisions be full copies or diffs?
- [ ] When client approves one option, do others auto-decline?
- [ ] Maximum number of options/revisions per request?
- [ ] Should the client see version history or only the latest?
- [ ] How does this interact with quote-to-job conversion (S-0012)?
