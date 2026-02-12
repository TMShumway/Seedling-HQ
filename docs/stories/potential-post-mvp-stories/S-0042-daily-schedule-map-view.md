# S-0042: Daily Schedule Map View

Status: Post-MVP (not scheduled)
Priority: P1 — essential for daily field operations
Epic: E-0015 (Route Planning + Maps)
Depends on: S-0013 (Calendar view), S-0015 (Tech Today view)

Context: A technician or dispatcher with 6-10 visits in a day needs to see them geographically to plan an efficient route. Currently the calendar shows a time-based list. Adding a map view with pins for each stop transforms daily planning from guesswork to visual routing.

Goal: Show daily scheduled visits on an interactive map alongside the list view, with property addresses geocoded to map pins.

Recommended approach:
- Map toggle on the calendar day view and the tech Today view (list | map | split)
- Geocode property addresses: add `latitude`/`longitude` columns to `properties` table, geocode on create/update via a geocoding service (Google Maps Geocoding API or Mapbox)
- Map component: Mapbox GL JS or Google Maps JavaScript API (Mapbox is more cost-effective at scale)
- Map pins: numbered by visit order, color-coded by status (scheduled=blue, en_route=yellow, completed=green, skipped=gray)
- Click pin → popover with visit details (client name, address, scheduled time, service type)
- "Navigate" button on each pin → opens Google Maps / Apple Maps with the address for turn-by-turn directions
- Split view: map on top, list on bottom (mobile) or side by side (desktop)

Open questions:
- Mapbox vs Google Maps (cost, feature set, offline support)?
- Should geocoding happen client-side or server-side?
- How to handle addresses that fail geocoding (rural properties, new developments)?
- Store geocoded coordinates permanently or re-geocode on demand?
- Should the map show traffic data?
