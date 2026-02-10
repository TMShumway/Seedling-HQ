# S-0037: Route Optimization + Reordering

Status: Post-MVP (not scheduled)
Priority: P2 — differentiator feature
Epic: E-0015 (Route Planning + Maps)
Depends on: S-0036 (Map view)

Context: Once visits are on a map, the natural next step is optimizing the route — minimizing drive time between stops. This is the Traveling Salesman Problem (TSP), and even an approximate solution saves significant time and fuel costs. Most field service competitors offer some form of route optimization.

Goal: Allow dispatchers and techs to optimize the order of their daily visits to minimize drive time, with manual drag-to-reorder as a fallback.

Recommended approach:
- "Optimize route" button on the daily map view
- Add `route_order` integer column to visits (nullable — only set when route is optimized for a day)
- Optimization options:
  - Simple: nearest-neighbor heuristic (start from current location or office, always go to closest unvisited stop) — can be done client-side
  - Better: Google Maps Directions API or Mapbox Optimization API (handles real road distances, not just straight-line)
  - Full TSP solver: OR-Tools or similar, run server-side
- Start with the simple heuristic or Mapbox Optimization API (up to 12 waypoints on free tier)
- Manual reorder: drag-and-drop visits in the list to override optimized order
- Show total estimated drive time and distance for the optimized route
- "Directions" button → opens full route in Google Maps/Apple Maps

Open questions:
- Client-side heuristic vs. server-side optimization API?
- How to handle time windows (visit must be between 9-11am)?
- Should optimization consider a start point (office/home) and end point?
- Re-optimize when a visit is added, cancelled, or rescheduled mid-day?
- Cost implications of Google/Mapbox API calls per optimization?
