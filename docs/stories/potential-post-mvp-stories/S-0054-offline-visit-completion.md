# S-0054: Offline Visit Completion + Sync Queue

**Status:** Post-MVP (not scheduled)
**Priority:** P2 — critical for field reliability
**Epic:** E-0020 (PWA + Offline Support)
**Depends on:** S-0053 (PWA manifest), S-0016 (Job completion)

## Context

The most critical offline scenario: a tech finishes a job but has no signal to submit the completion. They shouldn't have to remember to submit later. An offline queue captures the completion data (status, notes, photos) and syncs automatically when connectivity returns.

## Goal

Allow technicians to complete visits offline, with automatic sync when connectivity is restored.

## Recommended approach

- IndexedDB queue: store pending actions (status changes, notes, photo uploads) in the browser's IndexedDB
- Visit completion form works offline: all data captured locally, stored in queue, confirmation shown to tech ("Saved offline — will sync when connected")
- Background sync (Service Worker Background Sync API): automatically replay queued actions when online
- Sync status indicator: badge on visits showing "pending sync" (with count of queued items)
- Conflict resolution: if the visit was modified server-side while offline (e.g., dispatcher rescheduled), show a conflict resolution UI
- Photo queue: photos stored in IndexedDB as blobs, uploaded via presigned URL on sync
- Retry logic: exponential backoff for failed syncs, surface persistent failures to the tech

## Open questions

- [ ] How long should offline data be retained before prompting the tech?
- [ ] What actions beyond visit completion should be queueable (status changes, notes, time tracking)?
- [ ] Conflict resolution strategy: last-write-wins, or manual merge?
- [ ] Storage limits for photos in IndexedDB (warn if approaching limits)?
- [ ] Should the owner/dispatcher see "pending sync" status for offline techs?
