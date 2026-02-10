# S-0053: PWA Manifest + Service Worker Caching

**Status:** Post-MVP (not scheduled)
**Priority:** P2 — improves field reliability
**Epic:** E-0020 (PWA + Offline Support)
**Depends on:** S-0015 (Tech Today view)

## Context

The Tech Today view (S-0015) is the primary mobile interface for field technicians. In the field, connectivity can be spotty — rural areas, basements, dead zones. A Progressive Web App (PWA) setup allows techs to "install" the app to their home screen and access cached content when offline, providing a native-app-like experience without app store distribution.

## Goal

Make the web app installable as a PWA with service worker caching for core assets and recently viewed data, so techs can access their schedule even with poor connectivity.

## Recommended approach

- PWA manifest (`manifest.json`): app name, icons (multiple sizes), theme color (match brand navy), display: standalone, start_url: /today
- Service worker (Workbox): cache-first strategy for static assets (JS, CSS, images, fonts), network-first for API responses with stale-while-revalidate fallback
- Cache key API responses: today's schedule, assigned visit details, client addresses — the data techs need most
- Install prompt: show "Add to Home Screen" banner on first mobile visit, suppress after dismissal
- Offline indicator: banner at top of screen when offline, "Data may be outdated" warning
- Background sync: when connectivity returns, sync any queued actions (see S-0054)
- Cache invalidation: clear stale data on login, after a configurable TTL

## Open questions

- [ ] Which API responses to cache (schedule + visits? client data? service catalog?)?
- [ ] Cache size limits (don't fill up the tech's phone storage)?
- [ ] How to handle auth token refresh when offline?
- [ ] Push notifications via service worker (web push) — include now or defer?
- [ ] Testing strategy for offline scenarios?
