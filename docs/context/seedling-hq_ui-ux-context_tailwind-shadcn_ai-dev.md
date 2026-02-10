# Seedling-HQ — UI/UX Context Pack (Tailwind + shadcn/ui) for AI‑Driven Development

_Last updated: 2026-02-09 (America/Chihuahua)_

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

Primary navigation (internal users), in sidebar order:
1) **Dashboard** — active (S-0001)
2) **Services** — active (S-0003): service catalog management
3) **Requests** — active (S-0006): public request form + authenticated list
4) **Clients** — active (S-0004): client/property management
5) **Quotes** — active (S-0009)
6) **Schedule** — stubbed (S-0012+)
7) **Jobs** — stubbed (S-0012+)
8) **Invoices** — stubbed (S-0017+)
9) **Settings** — active (S-0002): business profile and hours

> **Note (S-0003 decision):** Services is placed early (after Dashboard) because it's a setup-phase item that owners configure before taking on clients.

Mobile: same items in same order, accessed via hamburger → drawer nav.
Consider grouping in future:
- "Work" group: Requests, Schedule, Jobs
- "Money" group: Quotes, Invoices
- "People" group: Clients
- "Settings"

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

> **Established in S-0002 UI polish, updated with USWDS-inspired reskin:**
> - **Color palette:** deep navy primary (`#1e3a5f`), cooler slate background (`#f1f5f9`), stronger borders (`#cbd5e1`), deeper destructive red (`#b91c1c`)
> - **Dark sidebar:** slate-900 background (`#0f172a`), slate-400 text, blue-400 active highlight (`#60a5fa`)
> - **Border radii:** tight/crisp — sm=2px, md=4px, lg=6px, xl=8px
> - **Cards:** full-opacity borders (`border-border`), subtle shadows (`shadow-sm`), `hover:shadow-md` transitions
> - **Card accents:** colored left border (`border-l-4 border-l-{color}`) to differentiate card types (primary=business, sky-600=owner, blue-600=clients, teal-600=settings, amber-500=hours)
> - **Icon badges:** small rounded-lg background + icon in card headers for visual anchoring
> - **Welcome header:** plain text (no banner/gradient), tighter `space-y-5` spacing
> - **Onboarding CTA gradient:** `bg-gradient-to-r from-primary/8 via-primary/15 to-primary/8`
> - **TopBar:** hidden on desktop (`lg:hidden`) since Sidebar provides branding; only shows on mobile for hamburger menu
> - **Sidebar:** active nav uses `border-l-[3px] border-l-sidebar-primary bg-sidebar-accent text-white font-semibold` + `aria-current="page"`; disabled items use `text-sidebar-foreground/30`
> - **Mobile drawer:** dark background matching sidebar (`bg-sidebar-background`), same nav styling
> - **Focus indicators:** `ring-2` + `ring-offset-2` on buttons; `ring-2` on inputs/selects/textareas/checkboxes
> - **Button text:** `font-semibold` for stronger visual weight
> - **Success messages:** `border-green-300`, `text-green-800`, `font-medium`
> - **Branding:** "Seedling HQ" with seedling emoji (🌱) in sidebar, topbar, and mobile drawer
> - **Scroll on save:** use `document.querySelector('main')?.scrollTo()` — AppShell `<main>` is the scroll container, not `window`

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
- Input, Textarea (styled `<textarea>` wrapper)
- Select (native `<select>` wrapper, styled to match Input) / combobox (Radix, when needed)
- Date picker (choose one library; keep consistent)
- Checkbox (styled `<input type="checkbox">`) / toggle
- Form validation + inline field errors
- "Error summary" at top on submit failures (USWDS pattern)

> **Implemented in S-0002:** Input, Select, Textarea, Checkbox are in `apps/web/src/components/ui/`.
> Multi-step wizard stepper (numbered circles) in `OnboardingWizard.tsx`.
> **Gotcha:** Do NOT wrap multi-step wizards in `<form>` — native inputs (time, number) trigger implicit submit. Use `<div>` + explicit `onClick` handlers.

### Feedback
- Toasts (success/error)
- Inline banners (info/warn/error) — success banners use `CheckCircle2` icon + green border + `shadow-md` for visibility
- Empty states (with a CTA)
- Loading states (Skeleton component in `components/ui/skeleton.tsx`; disable submit buttons)

> **Implemented in S-0002:** `Skeleton` component (`animate-pulse rounded-md bg-muted`). Used in DashboardPage, SettingsPage, and OnboardingPage loading states.
> Success alert pattern: icon + bordered card + shadow for at-a-glance visibility. Scroll-to-top on save via `document.querySelector('main')?.scrollTo()` (AppShell `<main>` is the scroll container, not `window`).

### Data presentation
- **Desktop**: table for lists (clients, invoices), but keep it simple
- **Mobile**: card list + search + filters + detail pages
- Status badges/pills (Draft/Sent/Approved/Paid/Overdue/etc.)

### Workflow helpers
- Stepper for multi-step flows (quote builder, onboarding) — **Implemented in S-0002** as numbered step indicator in `OnboardingWizard`
- Confirm dialogs for destructive actions
- "Unsaved changes" guard on forms

---

## 7) MVP screen patterns (by epic)

### 7.1 Requests (lead intake)
Internal:
- Requests list with status badges + click-through to detail — **DONE** (S-0006)
- Request detail page with contact info, description, timestamps, status badge — **DONE** (S-0008)
- "Convert to Client" button (visible when status `new`/`reviewed`) → conversion form — **DONE** (S-0008)
- Conversion form: pre-fills name/email/phone from request, existing client match via email search, property address, quote title — **DONE** (S-0008)

External:
- Public request form (minimal, clear) — **DONE** (S-0006)
- Confirmation page — **DONE** (S-0006)

### 7.2 Clients (CRM)
- Clients list: search by name/phone/email, cursor-based pagination with "Load More"
- Client detail (tabbed layout — Info / Properties / Activity):
  - **Info tab:** contact info, tags, notes, edit + delete actions
  - **Properties tab:** properties/addresses list with "Add Property" action
  - **Activity tab:** audit-event timeline feed (newest first), toggle to hide deactivation events, "Load More" pagination
  - Quick actions (future): create quote, schedule, invoice

### 7.3 Quotes
Internal:
- Quote list: paginated list with status filter pills (all/draft/sent/approved/declined/expired), debounced search, status badges, click-through to detail — **DONE** (S-0009)
- Quote detail / builder: — **DONE** (S-0009)
  - select client + property (linked from quote header)
  - inline line-item builder with service item picker, custom description, quantity, unit price
  - editable tax rate with auto-computed subtotal, tax, and total
  - draft-only editing (sent/approved/declined/expired quotes are read-only)
  - send link — **DONE** (S-0010): "Send Quote" button (visible when draft + has line items) → inline confirmation card → sends quote → shows copyable secure-link card

External (secure link):
- Quote view — **DONE** (S-0010): `PublicQuoteViewPage` at `/quote/:token`
  - business name header + "Prepared for: clientName" + property address
  - line items table with description, qty, unit price, total columns
  - subtotal, tax, and total summary
  - approve button (captures name) — planned (S-0010+)
  - audit-friendly confirmation — planned (S-0010+)

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

### 7.6 Settings + Onboarding (S-0002 — implemented)
Internal:
- **Onboarding page** (`/onboarding`): choice card (Quick Setup vs Guided Setup), or "Already configured" if settings exist
- **Guided Setup wizard**: 4 steps — Business Info → Hours → Service Defaults → Review & Submit
- **Quick Setup**: single scrollable form with all fields
- **Settings page** (`/settings`): same form fields, pre-populated from saved data, "Save Settings" button
- **Dashboard CTA**: "Complete your business profile" card when settings are null; settings summary when configured

### 7.7 Client Hub (portal via secure link)
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

## 12) Quick "starter spec" (implementation status)

1) App shell (sidebar + mobile drawer) with placeholder pages — **DONE** (S-0001): Sidebar, TopBar, MobileDrawer in `apps/web/src/app-shell/`
2) Page header component pattern (title + actions) — **DONE** (S-0001/S-0002): consistent pattern in DashboardPage, SettingsPage, ServicesPage
3) Badge/status system — **PARTIAL** (S-0006/S-0009): `StatusBadge` implemented in RequestsPage (new=amber, reviewed=blue, converted=green, declined=gray) and QuotesPage (draft=gray, sent=blue, approved=green, declined=red, expired=amber); extend for Job/Invoice statuses (S-0012+/S-0017+)
4) Form components + validation approach + error summary — **DONE** (S-0002): Input, Select, Textarea, Checkbox in `apps/web/src/components/ui/`; validation via controlled state + Zod schemas
5) List patterns (desktop table + mobile cards) — **PARTIAL** (S-0003+): ServicesPage has category accordion + item rows (S-0003); ClientsPage has card list + search + cursor pagination (S-0004); RequestsPage has card list + search + status badges + click-through to detail (S-0006/S-0008); QuotesPage has card list + search + status filter pills + cursor pagination (S-0009)
   - Remaining: Invoices (S-0017+)
6) External page templates — **PARTIAL** (S-0010):
   - Quote view — **DONE** (S-0010): `PublicQuoteViewPage` at `/quote/:token` — business name header, "Prepared for: clientName", property address, line items table, subtotal/tax/total
   - Quote approve — planned (S-0010+)
   - Invoice view/pay — planned (S-0017+)
   - Client Hub — planned (future)

---

## Appendix — Recommended terminology (avoid confusion)

- **Tenant / Business / Account**: internal customer of Seedling-HQ
- **User**: a person who logs into Seedling-HQ (owner/tech/etc.)
- **Client**: external customer of a tenant
- **Property**: client service address
- **Secure link**: loginless token link for external access
