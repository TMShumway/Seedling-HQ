# Seedling-HQ — UI/UX Context Pack (Tailwind + shadcn/ui) for AI‑Driven Development

_Last updated: 2026-02-08 (America/Chihuahua)_

> Purpose: Paste this into a new LLM/agent so it can build consistent UI/UX for Seedling‑HQ without mockups.
> Stack choice: **React + Vite + TypeScript + TailwindCSS + shadcn/ui (Radix)**

---

## 1) Product UI goals (MVP)

Seedling‑HQ is a Jobber competitor for very small → small service businesses. The MVP must feel:
- **Fast and low-friction** (owners are busy; techs are on the go)
- **Trustworthy and clear** (USWDS‑inspired clarity: strong hierarchy, obvious affordances, readable forms)
- **Mobile-friendly without a mobile app** (responsive web as the “field app” in MVP)
- **Consistent and accessible** (keyboard support, focus states, contrast, ARIA)

---

## 2) Core UX principles (USWDS-inspired)

Use these principles everywhere:
1) **Clarity over cleverness**
   - Prefer explicit labels and helper text.
   - Avoid icon-only actions unless paired with tooltip + accessible label.
2) **Form-forward, workflow-first**
   - Make “next action” obvious: create quote, schedule visit, send invoice, collect payment.
3) **Readable density**
   - Desktop can show more context; mobile must avoid dense tables.
4) **Accessible by default**
   - Visible focus rings.
   - Proper labels, aria attributes, error summaries.
5) **Predictable navigation**
   - Same primary nav items and IA across desktop and mobile.

---

## 3) Responsive strategy (no mobile app)

### 3.1 Breakpoints (Tailwind defaults)
- `sm` (≥640): small tablets / large phones landscape
- `md` (≥768): tablets
- `lg` (≥1024): desktop

### 3.2 Layout pattern
**Desktop / tablet**
- Left **sidebar nav** (collapsible)
- Top bar with search (optional) + user menu
- Main content with consistent page headers and primary action

**Mobile**
- Top bar with:
  - hamburger → drawer nav
  - page title
  - primary action (if critical)
- Prefer **card lists** + drill-in detail pages
- Sticky “primary action” bar is allowed on key flows (Tech Today, scheduling)

### 3.3 Avoid on mobile
- Multi-column tables as the primary interface
- Multi-pane layouts that require horizontal scrolling
- Long multi-step forms on one screen (use steps)

---

## 4) Information architecture (MVP nav)

Primary navigation (internal users):
1) **Inbox / Requests**
2) **Clients**
3) **Quotes**
4) **Schedule**
5) **Jobs**
6) **Invoices**
7) **Reports** (can be stubbed)
8) **Settings**

Mobile: same items, but consider grouping:
- “Work” group: Requests, Schedule, Jobs
- “Money” group: Quotes, Invoices
- “People” group: Clients
- “Settings”

External customers (no login) access only via secure links:
- Quote view/approve
- Invoice view/pay
- Client Hub (appointments + open invoices + pay)

---

## 5) Design tokens & styling rules (Tailwind + shadcn)

### 5.1 Use shadcn/ui as the component foundation
- Buttons, dialogs, dropdowns, forms, toasts, tabs, etc.
- Prefer Radix-powered components for accessibility.

### 5.2 Styling posture
USWDS inspiration:
- Generous spacing
- Strong typography hierarchy
- Minimal shadows, clearer borders
- Clear error/success messaging
- Obvious focus states

### 5.3 Theme requirements
- Support light theme for MVP; dark theme optional later.
- Ensure AA contrast for text and key UI elements.
- Keep radii consistent (shadcn defaults are fine).

---

## 6) Component inventory (MVP “must have”)

Use these shadcn/ui components (or equivalents) consistently:

### Navigation / shell
- App sidebar (desktop)
- Drawer sheet (mobile)
- Breadcrumbs (optional)
- Page header pattern:
  - Title
  - Short description (optional)
  - Primary action button
  - Secondary actions in dropdown (kebab menu)

### Forms
- Input, textarea
- Select/combobox (Radix)
- Date picker (choose one library; keep consistent)
- Checkbox/toggle
- Form validation + inline field errors
- “Error summary” at top on submit failures (USWDS pattern)

### Feedback
- Toasts (success/error)
- Inline banners (info/warn/error)
- Empty states (with a CTA)
- Loading states (skeletons; disable submit buttons)

### Data presentation
- **Desktop**: table for lists (clients, invoices), but keep it simple
- **Mobile**: card list + search + filters + detail pages
- Status badges/pills (Draft/Sent/Approved/Paid/Overdue/etc.)

### Workflow helpers
- Stepper for multi-step flows (quote builder, onboarding)
- Confirm dialogs for destructive actions
- “Unsaved changes” guard on forms

---

## 7) MVP screen patterns (by epic)

### 7.1 Requests (lead intake)
Internal:
- Requests list with status + quick actions
- Request detail with “Convert to client + quote draft” CTA

External:
- Public request form (minimal, clear)
- Confirmation page

### 7.2 Clients (CRM)
- Clients list: search by name/phone/email
- Client detail:
  - contact info
  - properties/addresses
  - activity timeline feed (newest first)
  - quick actions: create quote, schedule, invoice

### 7.3 Quotes
Internal:
- Quote list: Draft/Sent/Approved
- Quote builder:
  - select client + property
  - add services
  - totals
  - send link

External (secure link):
- Quote view:
  - clear summary + line items
  - approve button (captures name)
  - audit-friendly confirmation

### 7.4 Scheduling / Jobs / Visits
Internal:
- Calendar view: week/day
- Job detail: status + visits list
- Visit edit modal/page

Tech (internal user, mobile-first):
- “Today” page:
  - big cards with address, time, status actions
  - actions: En Route / Started / Completed
  - completion flow: notes + photo upload

External:
- Appointment reminder pages should be simple, mostly informational

### 7.5 Invoices + payments
Internal:
- Invoice draft → send
- AR dashboard: filter by status/date

External (secure link):
- Invoice view: amount due, due date, line items
- Pay CTA (Stripe)
- Payment success page

### 7.6 Client Hub (portal via secure link)
External:
- Minimal “hub” page:
  - upcoming visits
  - open invoices with pay buttons
  - contact info / business branding

---

## 8) Accessibility & quality bar (definition of done for UI)

Every UI story should meet:
- Keyboard navigation works (Tab/Shift+Tab, Enter/Space)
- Visible focus state on interactive elements
- Form fields have labels; errors are linked to fields
- Buttons have clear text; icon buttons have aria-labels
- Mobile tap targets are comfortable (avoid tiny icons)
- No horizontal scrolling on mobile
- Loading & empty states present for lists and async actions

---

## 8.5 Regular accessibility + responsive audits (required)

Because MVP success depends on “works everywhere” UX, run **regular audits** (not one-time checks):

- **Accessibility audits**
  - Keyboard-only navigation pass
  - Focus order + focus visibility checks
  - Form label + error association review
  - Contrast checks on key UI states (hover/focus/disabled/error)
  - Screen reader spot-checks on high-impact flows (approve quote, pay invoice, tech complete visit)

- **Responsive audits**
  - Verify key flows at common breakpoints (mobile, tablet, desktop)
  - Ensure no horizontal scrolling on mobile
  - Validate tap-target sizing and spacing for thumbs
  - Confirm tables degrade gracefully into cards/details on mobile

Minimum cadence:
- Run these audits **at the end of every epic** and **before each MVP release candidate**.


---

## 9) UX rules for external customers (secure link pages)

External pages are:
- **Loginless**
- **Scope-limited** to the object(s) in the token
- **Minimal** (no internal navigation)

UI requirements:
- Explain what the page is (“Quote from <BusinessName>”)
- Clear primary action (“Approve quote”, “Pay invoice”)
- Provide help/contact info and a fallback (“Call us at …”)
- Show audit confirmation (“Approved on …” / “Payment received …”)

---

## 10) AI agent instructions (how to build UI in this repo)

When an AI agent adds UI:
1) Use shadcn/ui components first (don’t invent custom widgets unless needed).
2) Use Tailwind utilities; avoid one-off CSS files.
3) Implement desktop + mobile patterns explicitly:
   - tables on desktop only
   - card lists on mobile
4) Keep page headers consistent (title + primary action).
5) Use the typed API client generated from OpenAPI.
6) Add meaningful empty/loading/error states.
7) Always include a local demo path in story notes.

---

## 11) UI pitfalls & things to watch

- **Too much table UI**: mobile suffers; prefer cards + drill-in.
- **Inconsistent actions**: “Send”, “Approve”, “Pay” must look/behave the same everywhere.
- **Overuse of modals**: on mobile, full-page flows are often better.
- **Validation chaos**: ensure a single form validation strategy and consistent error rendering.
- **Status mismatch**: define a small consistent set of statuses for Request/Quote/Job/Visit/Invoice and render them as badges everywhere.

---

## 12) Quick “starter spec” (first UI tasks to implement)

1) App shell (sidebar + mobile drawer) with placeholder pages
2) Page header component pattern (title + actions)
3) Badge/status system
4) Form components + validation approach + error summary
5) List patterns (desktop table + mobile cards) for:
   - Requests
   - Clients
   - Quotes
   - Invoices
6) External page templates:
   - Quote view/approve
   - Invoice view/pay
   - Client Hub

---

## Appendix — Recommended terminology (avoid confusion)

- **Tenant / Business / Account**: internal customer of Seedling-HQ
- **User**: a person who logs into Seedling-HQ (owner/tech/etc.)
- **Client**: external customer of a tenant
- **Property**: client service address
- **Secure link**: loginless token link for external access
