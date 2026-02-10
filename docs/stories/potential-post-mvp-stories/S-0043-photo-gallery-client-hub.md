# S-0043: Before/After Photo Gallery on Client Hub

**Status:** Post-MVP (not scheduled)
**Priority:** P1 — showcases work quality to clients
**Epic:** E-0018 (Enhanced Client Hub)
**Depends on:** S-0016 (Job completion with photos), S-0020 (Client Hub)

## Context

S-0016 captures photos on visit completion (uploaded to S3 via presigned URLs). S-0020 provides a Client Hub via secure link. Currently, photos are only visible internally. Showing before/after photos to clients via the hub demonstrates work quality, justifies pricing, and creates a visual history of their property over time.

## Goal

Display visit photos in the Client Hub organized by property and date, with before/after pairing where available.

## Recommended approach

- Photo association: photos already linked to visits (S-0016); visits linked to properties via jobs
- Before/after tagging: add `photo_type` enum to visit photos (before/after/progress/other) — tech tags on upload
- Client Hub photos section: property page shows photo timeline, grouped by visit date
  - Before/after pairs displayed side by side
  - Lightbox for full-size viewing
  - Chronological: newest first, shows property transformation over time
- Photo permissions: only show photos from completed visits (not in-progress)
- Lazy loading: thumbnail grid, full images loaded on click (S3 presigned URLs with short TTL)
- Optional: owner can mark certain photos as "featured" or "hidden" before they appear on hub

## Open questions

- [ ] Should the tech be prompted for before/after tagging at upload time, or can the owner tag later?
- [ ] Allow clients to download photos?
- [ ] Photo quality/compression — upload originals or optimize for web?
- [ ] Should photos appear on the hub automatically or require owner approval?
- [ ] Gallery view vs. timeline view — what's more useful for clients?
