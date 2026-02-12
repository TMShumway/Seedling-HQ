# S-0056: Weather Forecast on Calendar View

**Status:** Post-MVP (not scheduled)
**Priority:** P2 — low effort, high perceived value
**Epic:** E-0021 (Weather Integration)
**Depends on:** S-0013 (Calendar view)

## Context

Landscaping work is weather-dependent. Rain means mowing gets pushed. Extreme heat means irrigation checks are urgent. Currently, dispatchers alt-tab to a weather app. Showing a 7-day forecast inline on the calendar saves time and supports better scheduling decisions.

## Goal

Display weather forecast data on the calendar view so dispatchers can see conditions when scheduling visits.

## Recommended approach

- Weather data source: OpenWeatherMap API (free tier: 1,000 calls/day, 7-day forecast) or WeatherAPI (free tier: 1M calls/month)
- Business location: use the tenant's address from BusinessSettings for forecast location
- Calendar integration: small weather icon + high/low temp on each day header in the calendar view
  - Hover/click for details: precipitation chance, wind speed, humidity
  - Rain days highlighted (light blue background) as a visual cue
- Cache weather data: fetch once daily per tenant (or on calendar load with 1-hour cache), store in Redis or in-memory
- Mobile: weather shown as a compact strip above the day's schedule
- No weather-based automation in this story (see S-0057 for that)

## Open questions

- [ ] Which weather API to use (cost, reliability, data quality)?
- [ ] Per-property weather (properties in different zip codes) or per-business location?
- [ ] Should the forecast include multi-location support for businesses that serve wide areas?
- [ ] Hourly vs daily forecast granularity?
- [ ] Store historical weather data (for "how did weather affect our schedule" analytics)?
