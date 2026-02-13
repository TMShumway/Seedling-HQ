# Established Patterns

> Reference catalog of recurring implementation patterns.
> Linked from [CLAUDE.md](../../CLAUDE.md). Consult when implementing new stories that touch similar areas.

## Backend

| Pattern | Story | Description |
|---------|-------|-------------|
| UnitOfWork for atomic writes | S-0001 | `UnitOfWork` port + `DrizzleUnitOfWork`; use cases take `(readRepo, uow)` |
| Defensive unique-constraint catch | S-0001 | Wrap `uow.run()` in try/catch; map SQL state `23505` → `ConflictError` via `isUniqueViolation()` |
| Singleton upsert | S-0002 | `onConflictDoUpdate` on unique `tenant_id` constraint; no UoW needed |
| Audit event derivation | S-0002 | Compare `createdAt` vs `updatedAt` timestamps to determine created/updated event |
| GET returns null on empty | S-0002 | Return `null` with 200 for "not yet configured" singletons, not 404 |
| Read-only routes skip use cases | S-0003 | List/getById call repo directly in route handlers |
| Soft delete via active flag | S-0003 | Set `active = false`, return 204; parent deactivation cascades to children |
| Price in integer cents | S-0003 | Store cents in DB, dollars in UI; `dollarsToCents()` / `centsToDollars()` |
| DELETE returns 204 | S-0003 | Frontend `request()` handles 204 by returning `undefined` |
| Cursor-based pagination | S-0004 | `encodeCursor`/`decodeCursor` (base64url JSON); fetch limit+1 to detect `hasMore` |
| Server-side search (ILIKE) | S-0004 | `OR(ILIKE(col, %term%))` across name/email/phone/company columns |
| Count endpoint | S-0004 | `GET /v1/clients/count` for dashboard metrics |
| Nested + flat URLs | S-0004 | Properties listed at `/v1/clients/:clientId/properties`, operated at `/v1/properties/:id` |
| Post-trim validation on updates | S-0004 | Update use cases must validate required fields after trimming; create and update paths should have matching validation |
| Timeline via audit_events query | S-0005 | `listBySubjects(tenantId, subjectIds[], filters)` — no new table, reuse audit_events with composite index; always pass `subjectTypes` filter to match the `(tenant_id, subject_type, subject_id, created_at)` index |
| Event label mapping | S-0005 | `getEventLabel()` maps `client.created` → "Client created" etc.; titlecase fallback for unknown events |
| Timeline exclude filter | S-0005 | `?exclude=deactivated` filters out `*.deactivated` event names server-side |
| Public endpoint (no auth) | S-0006 | `/v1/public/*` routes skip auth middleware; use `publicRequest()` on frontend (no dev auth headers) |
| Honeypot spam protection | S-0006 | Hidden `website` field; if filled, return fake 201 with random UUID, don't persist |
| In-memory rate limiter | S-0006 | Sliding window `Map<ip, {count, windowStart}>`, configurable window/max, periodic cleanup; `resetRateLimitStore()` for tests; `trustProxy: true` in Fastify for correct client IP behind ALB/API Gateway |
| Tenant resolution via slug | S-0006 | Public routes use `:tenantSlug` param → `tenantRepo.getBySlug()` to resolve tenant |
| System audit principal | S-0006 | Public/automated actions use `principalType: 'system'`, `principalId: 'public_form'` |
| Count by status endpoint | S-0006 | `GET /v1/requests/count?status=new` for dashboard metrics with status filter |
| Message outbox pattern | S-0007 | `MessageOutboxRepository.create()` → SMTP send → `updateStatus(sent/failed)`; outbox IS the durable record |
| Best-effort notification | S-0007 | `SendRequestNotificationUseCase` wraps all logic in try/catch — never throws; route handler awaits but failures are silent |
| Notification wiring in routes | S-0007 | Route handler calls notification use case after `CreatePublicRequestUseCase`; keeps create use case unchanged |
| SMS outbox as queued | S-0007 | SMS outbox records created with `status: 'queued'`; actual sending deferred to S-0021 worker |
| Atomic cross-entity conversion | S-0008 | `ConvertRequestUseCase` writes client + property + quote + request status update + 3-4 audit events inside single `uow.run()` |
| Extended TransactionRepos | S-0008 | UoW provides `clientRepo`, `propertyRepo`, `requestRepo`, `quoteRepo` alongside original `tenantRepo`, `userRepo`, `auditRepo` |
| Request `updateStatus` with race guard | S-0008 | `RequestRepository.updateStatus(tenantId, id, status, expectedStatuses?)` adds `WHERE status IN (...)` to prevent concurrent double-convert; returns `null` (0 rows) if another transaction already transitioned the status → throw `ConflictError` to roll back |
| Composite convert endpoint | S-0008 | `POST /v1/requests/:id/convert` returns 200 (not 201) with `{ request, client, property, quote, clientCreated }` |
| Existing client match on convert | S-0008 | Optional `existingClientId` skips client creation; frontend searches by email with debounced query |
| Quote list with status filter | S-0009 | `GET /v1/quotes?status=draft&search=term` with cursor pagination; `QuoteRepository.list()` follows `DrizzleRequestRepository.list()` pattern |
| UpdateQuoteUseCase (no UoW) | S-0009 | Direct repo + best-effort audit (follows `UpdateClientUseCase` pattern); draft guard, line item validation, total recomputation |
| Quote routes (6 endpoints) | S-0009/S-0010/S-0026 | `GET /v1/quotes`, `GET /v1/quotes/count`, `POST /v1/quotes` (S-0026), `POST /v1/quotes/:id/send` (S-0010), `GET /v1/quotes/:id`, `PUT /v1/quotes/:id`; count registered before `:id` to avoid route conflict |
| External token middleware | S-0010 | `buildExternalTokenMiddleware({ secureLinkTokenRepo, config, requiredScope, requiredSubjectType? })` — hashes incoming `:token` param, validates expiry/revocation/scope/subjectType, sets `request.externalAuthContext`; returns 403 `LINK_INVALID` on failure; missing referenced object also returns 403 (not 404) to avoid leaking existence |
| hashToken utility | S-0010 | `hashToken(secret, rawToken)` in `shared/crypto.ts` — HMAC-SHA256, returns 64-char hex; used in both middleware and SendQuoteUseCase |
| SendQuoteUseCase (atomic + best-effort) | S-0010 | Inside `uow.run()`: updateStatus(draft→sent) + create token + audit; after UoW (best-effort): get client email, create outbox, send email |
| Quote send route + external view | S-0010 | `POST /v1/quotes/:id/send` (authenticated, returns `{ quote, token, link }`), `GET /v1/ext/quotes/:token` (external, token-derived auth, returns quote + businessName + clientName + propertyAddress) |
| Quote `updateStatus` with race guard | S-0010 | `QuoteRepository.updateStatus(tenantId, id, status, statusFields?, expectedStatuses?)` — `WHERE status IN (...)` prevents concurrent transitions; returns null if 0 rows (caller handles: SendQuoteUseCase throws ConflictError, RespondToQuoteUseCase re-fetches for idempotency) |
| RespondToQuoteUseCase (single class) | S-0011 | Parameterized by `action: 'approve' | 'decline'`; no UoW needed (single entity write + best-effort audit + notification); race-safe idempotency: on null updateStatus, re-fetches quote — same-action race → 200 with current state, cross-action race → 400 ValidationError |
| External approve/decline routes | S-0011 | `POST /v1/ext/quotes/:token/approve` and `/decline`; `respondMiddleware` requires `quote:respond` scope; returns `{ quote: { id, status, approvedAt, declinedAt } }` |
| Quote response notification | S-0011 | Best-effort email to owner via outbox; `buildQuoteResponseEmail()` inline HTML builder; type `quote_approved`/`quote_declined` in outbox |
| CreateStandaloneQuoteUseCase (no UoW) | S-0026 | Direct repo + best-effort audit; validates client (exists, active), property (optional: exists, active, belongs to client); creates draft with empty line items |
| POST /v1/quotes route | S-0026 | Body: `{ clientId, propertyId?, title }`; returns 201; `propertyRepo` added to `buildQuoteRoutes` deps |
| AUTH_MODE route guard | S-0027 | Return 404 when `config.AUTH_MODE !== 'local'` to hide dev-only endpoints in cognito mode |
| Cross-tenant user lookup | S-0027 | `listActiveByEmail(email)` joins users+tenants, case-insensitive via `lower()` (not `ilike` — avoids `_`/`%` wildcard leaks), filters both active; used by login endpoint |
| Auth routes (separate file) | S-0027 | `buildAuthRoutes({ userRepo, config })` in `auth-routes.ts`; public (no auth middleware), rate-limited |
| Zod trim+lowercase before email | S-0027 | `z.string().trim().toLowerCase().email()` ensures normalization happens before validation |
| CDK standalone workspace | S-0028 | `infra/cdk/` with own `package.json`; install with `pnpm install --ignore-workspace`; deploy with `pnpm dlx aws-cdk@2 deploy --context env=dev --context owner=<name>` |
| CDK resource naming + tags | S-0028 | Prefix `fsa-${env}-${owner}` on all resources; tags: `app=fsa`, `env`, `owner`; `RemovalPolicy.DESTROY` for dev sandbox |
| DevSandboxStack construct | S-0028 | `lib/dev-sandbox-stack.ts` takes `env_name`, `owner`, `allowedOrigin`; provisions User Pool + Groups + App Client; outputs UserPoolId, UserPoolArn, AppClientId, JwksUrl, AllowedCorsOrigin |
| JwtVerifier port + CognitoJwtVerifier | S-0029 | Port: `application/ports/jwt-verifier.ts`; impl: `infra/auth/cognito-jwt-verifier.ts`; uses `jose.jwtVerify()` + `createRemoteJWKSet`; validates issuer, `client_id` (not `aud`), `token_use=access`, `custom:tenant_id` (UUID format), `username` (UUID format), exactly-one `cognito:groups` |
| Bearer token extraction in middleware | S-0029 | `buildAuthMiddleware({ config, jwtVerifier? })` — cognito path extracts `Bearer <token>` from `Authorization` header, calls `jwtVerifier.verify()`, sets `authContext` |
| Cognito config conditional validation | S-0029 | `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_REGION` required via `required()` when `AUTH_MODE=cognito`, default to `''` via `optional()` when `local` |
| Fail-fast verifier creation | S-0029 | `createApp()` creates `CognitoJwtVerifier` at startup when `AUTH_MODE=cognito`; throws immediately if config is invalid |
| CDK pre-token-generation Lambda | S-0029 | `Code.fromInline()` JS function copies `custom:tenant_id` into access token; wired via `userPool.addTrigger(PRE_TOKEN_GENERATION_CONFIG, fn, LambdaVersion.V2_0)` |
| Cognito lookup route | S-0030 | `POST /v1/auth/cognito/lookup` — public, rate-limited, returns `cognitoUsername` (= `users.id`); reuses `listActiveByEmail()` and `loginBodySchema`; 404 when `AUTH_MODE !== 'cognito'` |
| Tenant creation gate | S-0030 | `POST /v1/tenants` returns 404 in cognito mode — early return before use case execution; 404 response schema added |
| Local password verify route | S-0030 | `POST /v1/auth/local/verify` — public, rate-limited 10/min; accepts `{ userId, password }`, returns `{ user }` or 401; 404 in cognito mode |
| Password hashing utility | S-0030 | `hashPassword()` / `verifyPassword()` in `shared/password.ts` — scrypt via `node:crypto`, self-describing stored format, timing-safe compare |
| getByIdGlobal on UserRepository | S-0030 | Cross-tenant user lookup by ID (no tenantId filter); used by verify endpoint to find user regardless of tenant |
| CognitoProvisioner port + impls | S-0031 | `application/ports/cognito-provisioner.ts` — `provisionUser()` + `setUserPassword()`; `AwsCognitoProvisioner` (AWS SDK) + `NoopCognitoProvisioner` (local mode) |
| CreateUserUseCase with re-provision | S-0031 | If disabled user exists with same email, re-uses UUID and re-enables; atomically provisions DB + Cognito in UoW |
| Role hierarchy inline guards | S-0031 | Owner > Admin > Member — checked inline in use case/route; `ForbiddenError` on violation; full RBAC deferred to S-0036 |
| User CRUD routes (3 endpoints) | S-0031 | `GET /v1/users` (list), `POST /v1/users` (create), `POST /v1/users/:id/reset-password`; owner/admin only; mode-specific Zod body schemas |
| Change own password route | S-0031 | `POST /v1/users/me/password` (local mode, any role); requires `currentPassword`; scrypt verify + re-hash; best-effort audit |
| CreateJobFromQuoteUseCase (atomic + idempotent) | S-0012 | Inside `uow.run()`: updateStatus(approved→scheduled) + create job + create visit + 3 audit events; pre-check for scheduled status; scoped unique violation catch |
| Job routes (5 endpoints) | S-0012 | `GET /v1/jobs`, `GET /v1/jobs/count`, `GET /v1/jobs/by-quote/:quoteId`, `POST /v1/jobs`, `GET /v1/jobs/:id`; count and by-quote registered before `:id` |
| RespondToQuoteUseCase scheduled idempotency | S-0012 | When `action === 'approve'` and `quote.status === 'scheduled'`: return idempotent success (quote was approved then progressed) |
| PublicQuoteViewPage scheduled support | S-0012 | `['approved', 'scheduled'].includes(quote.status)` for "already approved" banner display |
| ScheduleVisitUseCase (no UoW) | S-0013 | Direct repo + best-effort audit; status guard in `updateSchedule` SQL; emits `visit.time_set` (first) or `visit.rescheduled` (subsequent) with metadata JSONB |
| Visit routes (4 endpoints) | S-0013/S-0014 | `GET /v1/visits` (date range), `GET /v1/visits/unscheduled`, `PATCH /v1/visits/:id/schedule`, `PATCH /v1/visits/:id/assign`; unscheduled registered before `:id`; range limit 8 days; `?assignedUserId=` filter on GETs (S-0014) |
| VisitWithContext JOIN query | S-0013 | `listByDateRange` and `listUnscheduled` JOIN jobs+clients+LEFT JOIN properties for calendar context fields |
| Audit metadata JSONB | S-0013 | Nullable `metadata` column on `audit_events`; used for structured context (timestamps) in `visit.time_set`/`visit.rescheduled` |
| AssignVisitUseCase (no UoW) | S-0014 | Direct repo + best-effort audit; role guard (owner/admin); validates user active; no-op detection (same assignee); emits `visit.assigned`/`visit.unassigned` with user name metadata |
| Visit routes (4 endpoints) | S-0014 | Added `PATCH /v1/visits/:id/assign`; extended GET endpoints with `?assignedUserId=` filter; `userRepo` passed to `buildVisitRoutes` |
| VisitWithContext LEFT JOIN users | S-0014 | `listByDateRange` and `listUnscheduled` LEFT JOIN users for `assignedUserName` field |
| TransitionVisitStatusUseCase (no UoW) | S-0015 | Direct repo + best-effort audit + best-effort job derivation; status machine validation via `getValidTransitions()`; RBAC: cancel owner/admin, forward transitions owner/admin any or member own assigned |
| Visit routes (5 endpoints) | S-0015 | Added `PATCH /v1/visits/:id/status`; `jobRepo` added to `buildVisitRoutes` deps |
| VisitWithContext LEFT JOIN clients | S-0015 | `listByDateRange` and `listUnscheduled` LEFT JOIN clients for `clientPhone` and `clientEmail` fields |
| Job auto-derivation in use case | S-0015 | After visit status update: `started` + job `scheduled` → `in_progress`; all visits terminal: all cancelled → `cancelled`, >=1 completed → `completed`; non-terminal visits → no change |
| UpdateVisitNotesUseCase (no UoW) | S-0016 | Direct repo + best-effort audit; status guard (en_route/started/completed); RBAC: owner/admin any, member own assigned |
| Visit photo routes (4 endpoints) | S-0016 | `POST /v1/visits/:visitId/photos`, `POST .../confirm`, `GET /v1/visits/:visitId/photos`, `DELETE .../photos/:photoId`; separate route file `visit-photo-routes.ts` |
| FileStorage port + S3FileStorage | S-0016 | Port: `application/ports/file-storage.ts`; impl: `infra/storage/s3-file-storage.ts`; presigned POST for upload, presigned GET for download, best-effort delete |
| Photo pending/ready lifecycle | S-0016 | Create pending → upload to S3 → confirm (atomic quota check) → ready; stale pending cleanup (>15min) during create; soft pending cap 5, hard ready cap 20 |
| LocalStack S3 for local dev | S-0016 | `docker-compose.yml` localstack service; `infra/localstack/init-s3.sh` creates bucket with CORS; `S3_ENDPOINT` config for forcePathStyle |

## Frontend

| Pattern | Story | Description |
|---------|-------|-------------|
| Wizard as `<div>` not `<form>` | S-0002 | Native inputs trigger implicit submit in `<form>`; use explicit `onClick` |
| Local auth override via headers | S-0002 | `X-Dev-Tenant-Id` / `X-Dev-User-Id` in localStorage, sent on all requests |
| Scroll container is `<main>` | S-0002 | `document.querySelector('main')?.scrollTo()`, not `window.scrollTo()` |
| Loading skeletons | S-0002 | `Skeleton` component for async data loading states |
| Dollar/cents conversion | S-0003 | Convert before API calls and after responses |
| E2E scoped locators | S-0003 | Use `.filter({ hasText: ... })` when seed/test data coexist |
| `useInfiniteQuery` for pagination | S-0004 | React Query hook for "Load More" cursor-based pagination |
| Debounced search input | S-0004 | 300ms `setTimeout` in `useEffect` for search-as-you-type |
| Tab layout on detail pages | S-0005 | `useState<Tab>` + tab bar with `role="tablist"` + `role="tab"` + `role="tabpanel"` |
| Timeline component | S-0005 | `TimelineSection` with `useInfiniteQuery`, event icons, relative timestamps, "Hide removals" toggle |
| Public page (no AppShell) | S-0006 | Public pages like `/request/:tenantSlug` render outside `<AppShell>` (like SignupPage) |
| `publicRequest()` API function | S-0006 | Separate fetch wrapper that skips dev auth headers for public endpoints |
| Status badge component | S-0006 | Inline `StatusBadge` with color map for request statuses (new=amber, reviewed=blue, etc.) |
| Request detail + convert flow | S-0008 | `RequestDetailPage` shows request info + "Convert to Client" button; `ConvertRequestPage` pre-fills from request, supports existing client match, creates client+property+quote |
| Name splitting on convert | S-0008 | `splitName()` splits on last space for pre-fill; user can edit in form |
| QuotesPage with status filter pills | S-0009 | Row of pill buttons (All/Draft/Sent/Approved/Declined) controlling `statusFilter` state; `useInfiniteQuery` with status+search params |
| QuoteDetailPage inline builder | S-0009 | `LineItemRow` components with description/qty/price inputs; `ServiceItemPicker` dropdown grouped by category; auto-computed subtotal/total; editable tax input |
| Convert redirect to quote | S-0009 | `ConvertRequestPage` redirects to `/quotes/:id` on success (changed from `/clients/:id`) |
| Send quote confirmation flow | S-0010 | "Send Quote" button → inline confirmation card → success shows copyable link card; quote becomes read-only after send |
| Public quote view page | S-0010 | `/quote/:token` outside AppShell; uses `publicRequest()` to `GET /v1/ext/quotes/:token`; shows business name, client name, line items table, totals; 403 → "link no longer valid" |
| Copy-to-clipboard link | S-0010 | `navigator.clipboard.writeText()` with visual "Copied" feedback via useState toggle |
| Public quote approve/decline flow | S-0011 | Approve button → direct call; Decline button → confirmation dialog (state-based, matches send confirm pattern); success → status banner + hide buttons; `useEffect` resets respond state on token change |
| Already-responded read-only banners | S-0011 | If `status === 'approved'/'declined'` on page load, show date-stamped banner, hide action buttons |
| Quote detail timestamps | S-0011 | Below status badge: green "Approved on {date}" or red "Declined on {date}" from `quote.approvedAt`/`declinedAt` |
| CreateQuotePage with client search | S-0026 | Debounced search → radio select → property dropdown → auto-title → redirect to `/quotes/:id`; route `/quotes/new` before `/:id` |
| New Quote button on QuotesPage | S-0026 | `data-testid="new-quote-btn"` in header; updated empty state text |
| AuthGuard wrapping AppShell | S-0027 | `<AuthGuard><AppShell /></AuthGuard>` in Route element; checks localStorage, redirects to `/login` |
| Login page combined form | S-0027 | Email + password on single form → lookup → auto-select (single account) or account picker (multiple); cognito mode uses SDK `authenticateUser`; local mode calls `localVerify` |
| Logout in Sidebar + MobileDrawer | S-0027 | Clear `dev_tenant_id`/`dev_user_id` from localStorage, `navigate('/login')`; drawer also calls `onOpenChange(false)` |
| Login/Signup cross-links | S-0027 | LoginPage → "Don't have an account? Sign up"; SignupPage → "Already have an account? Log in" |
| AuthProvider wraps BrowserRouter | S-0030 | `<QueryClientProvider><AuthProvider><BrowserRouter>` — AuthProvider needs QueryClient for cache clear on logout; outside BrowserRouter intentionally |
| AuthGuard uses useAuth() | S-0030 | `isLoading` → render null; `!isAuthenticated` → `<Navigate to="/login">`; replaces direct localStorage check |
| Dual-mode LoginPage | S-0030 | Step machine: `login` (email + password) → `accounts` (multi-tenant picker) → `new-password` (cognito challenge); single account auto-selects in both modes |
| Signup disabled in cognito mode | S-0030 | `isCognitoMode()` → "Contact admin" card with link to login; local mode unchanged |
| Sidebar/Drawer useAuth().logout() | S-0030 | Replaces manual `localStorage.removeItem` + `queryClient.clear()` + `navigate('/login')` |
| api-client setAuthProvider | S-0030 | Module-level `authProvider` enables Bearer token injection + 401 retry; `clearAuthProvider()` on logout/auth failure |
| cognitoLookup DTO normalization | S-0030 | `apiClient.cognitoLookup()` maps `cognitoUsername` → `userId` so LoginPage uses unified `LoginAccount` type |
| Buffer polyfill for Cognito SDK | S-0030 | `buffer` npm package + `define: { global: 'globalThis' }` in vite.config.ts — SDK uses Node's `Buffer` |
| Local mode password verify | S-0030 | `authenticate()` calls `apiClient.localVerify(userId, password)` — real password check instead of accepting any password |
| Signup with password | S-0030 | SignupPage adds password + confirm fields; calls `createTenant({ ownerPassword })` then `authenticate(password)` for auto-login |
| TeamPage with role-gated actions | S-0031 | `useAuth()` for caller role; `canCreateUser(role)` gates invite button; `canResetPassword(callerRole, targetRole)` gates reset button |
| InviteMemberForm (mode-specific) | S-0031 | Local mode shows password field; cognito mode shows info text about temporary password email |
| ResetPasswordDialog | S-0031 | Card overlay with password + confirm; `useMutation` → `apiClient.resetUserPassword()`; auto-closes after success |
| ChangePasswordForm in SettingsPage | S-0031 | Current + new + confirm fields; calls `auth.changePassword()`; dual-mode (local calls API, cognito calls SDK) |
| Forgot password in LoginPage | S-0031 | Cognito: code + confirm steps; local: "contact admin" message; triggered from password step |
| Local auth localStorage persistence | S-0031 | `authenticate()` stores `dev_user_role`, `dev_user_name`, `dev_tenant_name`; init reads them back; logout clears all 5 keys |
| JobsPage with status filter + search | S-0012 | Status filter pills (All/Scheduled/In Progress/Completed/Cancelled), debounced search, `useInfiniteQuery`, `JobCard` component; follows QuotesPage pattern |
| JobDetailPage with embedded visits | S-0012 | Client/property/quote info cards, visits section with VisitStatusBadge; back to Jobs list; `data-testid="job-detail-page"` |
| Create Job from quote detail | S-0012 | "Create Job" button on approved quotes → `createJobFromQuote()` mutation → navigate to `/jobs/:id`; "View Job" link on scheduled quotes via `getJobByQuoteId()` |
| QuotesPage Scheduled filter/badge | S-0012 | Added `scheduled` to STATUS_FILTERS and badge colors on QuotesPage + QuoteDetailPage |
| SchedulePage week calendar | S-0013 | CSS Grid week view (`hidden lg:block`) + mobile day view (`lg:hidden`); `?week=YYYY-MM-DD` URL param; `useQuery(['visits', weekParam])` for range data |
| Unscheduled panel | S-0013 | Horizontal scroll of amber-styled cards above calendar; `useQuery(['unscheduled-visits'])`; click opens ScheduleVisitModal |
| ScheduleVisitModal | S-0013 | Card overlay with `<input type="datetime-local">`; auto-computed end; `useMutation` → `scheduleVisit` → invalidate `['visits']` + `['unscheduled-visits']` |
| JobDetailPage schedule actions | S-0013 | Scheduled visits: time is `<Link>` to `/schedule?week=YYYY-MM-DD`; unscheduled visits: "Schedule" button navigates to `/schedule` |
| ScheduleVisitModal tech picker | S-0014 | `useQuery(['users'])` for team list; `<select>` dropdown role-gated to owner/admin; dual mutation: schedule + assign with partial success warning |
| My Visits toggle | S-0014 | `data-testid="my-visits-toggle"` button in SchedulePage header; toggles `?mine=true` URL param; filters both calendar and unscheduled panel by `assignedUserId` |
| Calendar assignee display | S-0014 | Visit blocks show `assignedUserName` via `data-testid="visit-block-assignee"`; unscheduled cards show name or "Unassigned" via `data-testid="unscheduled-assignee"` |
| JobDetailPage assignment display | S-0014 | Visit cards show "Assigned to: Name" or "Unassigned" via cached users list; owner/admin see "Assign" link to `/schedule` |
| TodayPage with visit cards | S-0015 | `useQuery(['today-visits', userId, dateStr])` with `listVisits({ from, to, assignedUserId })`; `TodayVisitCard` with status badge, time window, duration, MapPin/Phone/Mail links; `useMutation` → `transitionVisitStatus` → invalidate `['today-visits']` + `['visits']` |
| TodayPage status action buttons | S-0015 | Per-status: scheduled → En Route + Start, en_route → Start, started → Complete, completed → timestamp, cancelled → text; `data-testid="action-en-route"`, `"action-start"`, `"action-complete"`, `"completed-time"` |
| JobDetailPage visit status actions | S-0015 | `VisitActions` component with status transition + cancel buttons; role-gated to owner/admin; cancel has confirmation toggle; invalidates `['job', id]`, `['visits']`, `['today-visits']` |
| VisitNotesSection in TodayPage | S-0016 | Inline textarea for en_route/started; read-only display for completed; `useMutation` → `updateVisitNotes` with explicit save button |
| PhotoUpload component | S-0016 | File input with `capture="environment"`; creates pending record → presigned POST to S3 → confirm; client-side 10MB + type validation; cleanup on failure |
| PhotoGallery component | S-0016 | Grid thumbnails with hover delete button; inline confirmation; `canDelete` prop gates edit mode |
| Completion confirmation | S-0016 | "Any notes or photos to add?" prompt before completing; "Complete Anyway" / "Go Back" buttons; state machine: idle → confirming → mutation |

## Testing

| Pattern | Story | Description |
|---------|-------|-------------|
| E2E DB isolation | S-0002 | `db:reset` → `db:push` → `db:seed` in globalSetup |
| Cross-project skip | S-0002 | `test.skip(testInfo.project.name !== 'desktop-chrome', 'reason')` inside test body |
| Integration DB sharing | S-0001 | `pool: 'forks'` + `singleFork: true` in vitest config |
| `setDemoAuth` E2E helper | S-0027/S-0031 | `e2e/helpers/auth.ts` — `page.addInitScript()` sets demo localStorage (tenant_id, user_id, role, name, tenant_name) before every page load; add to `test.beforeEach` in all authenticated E2E tests |
| Logout E2E uses `page.evaluate` | S-0027 | Don't use `addInitScript` when testing logout — it re-sets localStorage on navigation; use `page.evaluate(() => localStorage.setItem(...))` instead |
| E2E test isolation via dedicated seed data | S-0015 | When test file A mutates seeded data that test file B depends on, seed separate data for B. Today tests use John Smith's visit (2 PM) instead of Jane Johnson's (9 AM) which schedule.spec.ts mutates |
| Scoped E2E locators within cards | S-0015 | Use `page.getByTestId('card').filter({ hasText: 'Name' })` then scope button clicks within that card to avoid cross-card interference |
