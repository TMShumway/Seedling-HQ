# Post-MVP Roadmap

> Stories S-0033 through S-0061, organized by epic and release tier.
> MVP stories (S-0001 through S-0031) and S-0032 are defined elsewhere.

---

## Release Tiers

| Tier | Release | Focus | Epics |
|------|---------|-------|-------|
| **Tier 1** | R2 (immediate post-MVP) | Market viability | E-0012, E-0013, E-0014 |
| **Tier 2** | R2–R3 | High-value enhancements | E-0015, E-0016, E-0017, E-0018 |
| **Tier 3** | R3+ | Differentiators | E-0019, E-0020, E-0021, E-0022, E-0023 |

---

## Tier 1 — Must-Have for Market Viability

### E-0012: Recurring Services

The single most important post-MVP feature. Most lawn care and landscaping revenue comes from recurring contracts (weekly mowing, seasonal maintenance). Without this, the product only serves one-off project work.

| Story | Title | Priority | Depends on |
|-------|-------|----------|------------|
| S-0033 | Service agreement entity + CRUD | P0 | S-0009 (Quotes), S-0012 (Jobs) |
| S-0034 | Recurring visit auto-generation | P0 | S-0033 |
| S-0035 | Recurring invoicing + billing cycles | P0 | S-0033, S-0017 (Invoices) |

### E-0013: RBAC + Team Management

A 5–20 person business needs role-based access and the ability to invite team members. Currently all authenticated users can see everything.

| Story | Title | Priority | Depends on |
|-------|-------|----------|------------|
| S-0036 | Role-based permissions (API + UI gates) | P0 | S-0014 (Assign tech) |
| S-0037 | Invite + onboard team members | P0 | S-0036 |
| S-0038 | Crew grouping + multi-tech visit assignment | P1 | S-0036, S-0014 |

### E-0014: Reporting + Analytics

Owners need to know if they're making money. S-0019 (AR dashboard) is the only analytics story in MVP.

| Story | Title | Priority | Depends on |
|-------|-------|----------|------------|
| S-0039 | Revenue reports dashboard | P0 | S-0017 (Invoices) |
| S-0040 | Quote conversion + pipeline analytics | P1 | S-0009 (Quotes) |
| S-0041 | Job profitability reports | P1 | S-0012 (Jobs), S-0017 |

---

## Tier 2 — High-Value Enhancements

### E-0015: Route Planning + Maps

Techs with multiple daily stops need geographic ordering. Even a map without full optimization is essential for daily planning.

| Story | Title | Priority | Depends on |
|-------|-------|----------|------------|
| S-0042 | Daily schedule map view | P1 | S-0013 (Calendar), S-0015 (Today view) |
| S-0043 | Route optimization + reordering | P2 | S-0042 |

### E-0016: Communication Enhancements

Build on the existing outbox infrastructure (S-0021) with templates, auto-texts, and message history.

| Story | Title | Priority | Depends on |
|-------|-------|----------|------------|
| S-0044 | Message templates + quick-send | P1 | S-0021 (Outbox worker) |
| S-0045 | On-my-way + job completion auto-texts | P1 | S-0015 (Today view), S-0021 |
| S-0046 | Client communication history | P1 | S-0021 |

### E-0017: Quote Enhancements

Support multiple quote options per request and quote versioning for the back-and-forth revision cycle.

| Story | Title | Priority | Depends on |
|-------|-------|----------|------------|
| S-0047 | Multi-quote per request + revisions | P1 | S-0009 (Quote builder) |
| S-0048 | Quote expiration + auto-follow-up | P2 | S-0010 (Send quote), S-0023 (Follow-up automation) |

### E-0018: Enhanced Client Hub

Extend the Client Hub (S-0020) from read-only+pay to a richer self-service portal.

| Story | Title | Priority | Depends on |
|-------|-------|----------|------------|
| S-0049 | Before/after photo gallery on hub | P1 | S-0016 (Photos), S-0020 (Client Hub) |
| S-0050 | Service history + document access | P2 | S-0020 |
| S-0051 | Client self-service booking from hub | P2 | S-0006 (Public form), S-0020 |

---

## Tier 3 — Differentiators

### E-0019: Chemical/Treatment Compliance

Legal compliance requirement for businesses applying fertilizers, herbicides, or pesticides. Required in most US states.

| Story | Title | Priority | Depends on |
|-------|-------|----------|------------|
| S-0052 | Treatment record logging | P2 | S-0016 (Job completion) |
| S-0053 | Treatment reports + customer notices | P2 | S-0052 |

### E-0020: PWA + Offline Support

Field techs have spotty connectivity. PWA support makes the mobile experience more reliable.

| Story | Title | Priority | Depends on |
|-------|-------|----------|------------|
| S-0054 | PWA manifest + service worker caching | P2 | S-0015 (Today view) |
| S-0055 | Offline visit completion + sync queue | P2 | S-0054, S-0016 |

### E-0021: Weather Integration

Landscaping is weather-dependent. Low effort, high perceived value.

| Story | Title | Priority | Depends on |
|-------|-------|----------|------------|
| S-0056 | Weather forecast on calendar view | P2 | S-0013 (Calendar) |
| S-0057 | Rain delay bulk reschedule | P2 | S-0056, S-0013 |

### E-0022: Equipment + Inventory

Track equipment, maintenance schedules, and material costs for job profitability.

| Story | Title | Priority | Depends on |
|-------|-------|----------|------------|
| S-0058 | Equipment inventory + maintenance tracking | P2 | — |
| S-0059 | Material cost tracking per job | P2 | S-0012 (Jobs) |

### E-0023: Reputation Management

Automated feedback collection and review request campaigns.

| Story | Title | Priority | Depends on |
|-------|-------|----------|------------|
| S-0060 | Post-visit satisfaction survey | P2 | S-0016 (Job completion), S-0021 (Outbox) |
| S-0061 | Automated review request campaigns | P2 | S-0060 |

---

## Story Count Summary

| Tier | Epics | Stories | P0 | P1 | P2 |
|------|-------|---------|----|----|-----|
| Tier 1 | 3 | 9 | 6 | 3 | 0 |
| Tier 2 | 4 | 10 | 0 | 7 | 3 |
| Tier 3 | 5 | 10 | 0 | 0 | 10 |
| **Total** | **12** | **29** | **6** | **10** | **13** |

Plus S-0032 (In-App Notification Center) already defined as post-MVP.

---

## Dependency Chain (critical path)

```
MVP completion (S-0031)
  └─> E-0012: Recurring Services (S-0033 → S-0034 → S-0035)
  └─> E-0013: RBAC (S-0036 → S-0037, S-0038)
  └─> E-0014: Reporting (S-0039, S-0040, S-0041)
  └─> E-0015: Maps (S-0042 → S-0043)
  └─> E-0016: Comms (S-0044, S-0045, S-0046)
  └─> E-0017: Quote Enhancements (S-0047, S-0048)
  └─> E-0018: Client Hub+ (S-0049, S-0050, S-0051)
        └─> E-0019: Treatment (S-0052 → S-0053)
        └─> E-0020: PWA (S-0054 → S-0055)
        └─> E-0021: Weather (S-0056 → S-0057)
        └─> E-0022: Equipment (S-0058, S-0059)
        └─> E-0023: Reputation (S-0060 → S-0061)
```
