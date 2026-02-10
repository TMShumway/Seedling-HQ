# Seedling-HQ — Observability & Telemetry Spec Context Pack (MVP) for AI-Driven Development

_Last updated: 2026-02-10 (America/Chihuahua)_

> Purpose: Paste this into a new LLM/agent so it can implement **consistent observability** across API, worker, and UI.
> Scope: MVP baseline covering:
> - structured logs
> - correlation IDs
> - metrics
> - tracing (lightweight MVP)
> - audit events
> - alerting and dashboards (minimal but effective)
>
> Architecture: React+Vite (web), Fastify on Lambda behind API Gateway, Postgres, SQS workers, EventBridge Scheduler, SES/SMS.

---

## 1) Observability goals (MVP)

1) **Debug fast** (single request across web → api → db → worker)
2) **Prove tenant safety** (every log/audit event ties to tenant_id)
3) **Operate async reliably** (queue depth, failures, retries, DLQs)
4) **Monitor business-critical outcomes** (quote sent/approved, invoice paid, visit completed)
5) **Prevent regressions** (latency spikes, error rates, worker backlogs)

---

## 2) Unified event vocabulary (three types)

Seedling-HQ uses three distinct signal types. Do not mix them.

### 2.1 Operational logs (debugging)
- High volume
- Short retention acceptable
- Must be structured JSON

### 2.2 Metrics (health + SLOs)
- Aggregated counts, rates, durations
- Used for dashboards + alerts

### 2.3 Product analytics / telemetry events (behavior + funnel)
- Business/process events (signup, quote sent, invoice paid)
- Lower volume, stable schema

**Audit events** are separate from product telemetry:
- Audit = compliance/security record (who did what, when)
- Telemetry = behavior and product funnel (what happened)

---

## 3) Correlation & IDs (non-negotiable)

### 3.1 Required IDs in all server logs
- `request_id` (unique per HTTP request)
- `correlation_id` (propagated across async boundaries)
- `tenant_id` (whenever known)
- `principal_type` (`internal` | `system` | `external` (future))
- `principal_id` (user_id or token_id when known)

### 3.2 Propagation rules
- Web generates a `correlation_id` for each user interaction that triggers API calls.
- API ensures:
  - `request_id` exists (use API Gateway request id or generate).
  - `correlation_id` is read from `X-Correlation-Id` header or generated.
- For async jobs:
  - Include `correlation_id` in SQS message body or message attributes.
  - Worker logs reuse the same `correlation_id`.
- For scheduler-delivered SQS messages:
  - Store `correlation_id` in the scheduled payload at schedule creation time.

### 3.3 Naming conventions
Headers:
- `X-Correlation-Id`
- `X-Request-Id` (if you choose to expose)

DB fields (recommended for durable correlation):
- `correlation_id` on:
  - outbox messages
  - audit events
  - automation schedules (if you store them)

---

## 4) Structured logging spec (server)

### 4.1 Log format (JSON fields)
Every log line must be JSON with at least:
- `timestamp` (ISO)
- `level` (debug/info/warn/error)
- `service` (`api` | `worker`)
- `env` (`local` | `dev` | `staging` | `prod`)
- `request_id` (if applicable)
- `correlation_id`
- `tenant_id` (when applicable)
- `principal_type`, `principal_id` (when applicable)
- `event` (short string describing what happened)
- `message` (human-readable summary)
- optional: `duration_ms`, `status_code`, `route`, `method`

### 4.2 Error logs
On error, include:
- `error.name`
- `error.message`
- `error.stack` (server logs only; careful in prod)
- `error.code` (internal code if present)

Do not log:
- secure link tokens
- Authorization headers
- full PII (email/phone/address)
- Stripe secrets or raw webhook payloads with secrets

### 4.3 Request logging guidelines
- Log at start and end of request (info)
- Log validation failures (warn)
- Log authorization denials (warn)
- Log unexpected errors (error)
- Avoid logging full payloads; log only counts/ids

---

## 5) Metrics spec (MVP)

### 5.1 Metric dimensions (tags)
Keep metric cardinality low:
- `env`
- `service`
- `route` (low-cardinality normalized route, e.g. `/v1/quotes/:id`)
- `method`
- `status_code` (grouped: 2xx/4xx/5xx or exact)
- `queue_name` (for worker metrics)
- Avoid tenant_id as a metric dimension (too high cardinality)

### 5.2 API metrics (minimum set)
- `http_requests_total{route,method,status_class}`
- `http_request_duration_ms{route,method}` (p50/p95/p99 via EMF or a metrics backend)
- `http_errors_total{route,method,error_code}` (optional)

### 5.3 Worker metrics (minimum set)
- `worker_jobs_processed_total{job_type,result}`
- `worker_job_duration_ms{job_type}`
- `worker_retries_total{job_type}`
- `worker_dlq_total{queue_name}` (or derived from SQS DLQ metrics)

### 5.4 Domain/business “outcome” metrics (recommended)
These are counts and rates from core MVP spine:
- `requests_created_total`
- `quotes_sent_total`
- `quotes_approved_total`
- `visits_completed_total`
- `invoices_sent_total`
- `invoices_paid_total`
- `sms_sent_total{provider}`
- `email_sent_total`

---

## 6) Tracing (lightweight MVP recommendation)

MVP can succeed without full distributed tracing, but add a simple trace hook:
- Use `correlation_id` as the primary trace key.
- Optionally integrate AWS X-Ray later.

If you add tracing:
- Trace boundaries:
  - API Gateway → API Lambda
  - SQS → Worker Lambda
- Ensure trace IDs do not include PII.

---

## 7) Audit events (security/compliance baseline)

Audit events must be durable (stored in Postgres) and include:
- `tenant_id`
- `principal_type` (`internal` | `system` | `external` (future))
- `principal_id` (user_id or token_id)
- `event_name`
- `subject_type` (quote, invoice, visit, client_hub, etc.)
- `subject_id`
- `created_at`
- optional: `correlation_id`, `ip`, `user_agent`

Minimum audit events for MVP:
- `auth.signup` (internal)
- `tenant.created`
- `business_settings.created`, `business_settings.updated` (S-0002) — derived from upsert result timestamps, not pre-read (race-safe)
- `request.created`
- `quote.created` (S-0008), `quote.updated` (S-0009)
- `quote.sent`, `quote.viewed`, `quote.approved`
- `visit.scheduled`, `visit.rescheduled`, `visit.completed`
- `invoice.sent`, `invoice.viewed`, `invoice.paid`
- `message.sent` (email/SMS) with outbox id linkage
- `hub.viewed`

Audit events vs telemetry:
- Audit events must never be lossy.
- Telemetry events can be buffered/delayed.

---

## 8) Product telemetry events (analytics spec)

### 8.1 Event schema (stable)
Every telemetry event should contain:
- `event_name`
- `timestamp`
- `env`
- `tenant_id` (yes, include; but do not expose to 3rd parties)
- `principal_type`
- `principal_id` (optional; careful with PII)
- `correlation_id`
- `properties` (small, typed set)

### 8.2 Recommended MVP events (spine)
- `auth.signup`
- `tenant.created`
- `business_settings.configured` (first-time setup via onboarding wizard)
- `business_settings.updated` (subsequent edits via settings page)
- `client.created`
- `request.created`
- `request.converted`
- `quote.created`
- `quote.sent`
- `quote.viewed`
- `quote.approved`
- `job.created`
- `visit.scheduled`
- `visit.completed`
- `invoice.created`
- `invoice.sent`
- `invoice.paid`
- `notify.request.sent`
- `notify.quote.sent`
- `notify.invoice.sent`
- `reminder.scheduled`
- `reminder.sent`
- `reminder.canceled`

### 8.3 Telemetry destinations (MVP options)
- Start with Postgres table `telemetry_events` or CloudWatch logs stream
- Later: ship to a dedicated analytics tool

---

## 9) Logging/telemetry in the web app

### 9.1 Client-side logging (minimal)
In the browser:
- Keep client logs minimal.
- Prefer capturing errors via:
  - a global error boundary
  - unhandled promise rejection handler

Do not:
- log tokens or sensitive query params
- log full API responses containing PII

### 9.2 UI telemetry (recommended)
Track key UI events:
- page views for major sections
- primary CTA clicks
- form submit success/failure counts (no PII)

Always include:
- `correlation_id`
- `tenant_id` (internal app only)
- route/page name

---

## 10) Async flows observability (SQS, outbox, scheduler)

### 10.1 Outbox observability (implemented S-0007)
Outbox table (`message_outbox`) includes:
- `id`, `tenant_id`, `type`, `recipient_id`, `recipient_type`
- `channel` (email/sms), `subject`, `body`
- `status` (queued/scheduled/sent/failed)
- `provider`, `provider_message_id`
- `attempt_count`
- `last_error_code`, `last_error_message` (redacted in logs)
- `created_at`, `sent_at`
- `correlation_id`, `scheduled_for`

**Email (S-0007):** Status transitions `queued` → `sent`/`failed` synchronously at request time. Best-effort — errors logged but never block the API response.
**SMS (S-0007):** Records created as `queued` only. Worker processing deferred to S-0021.

### 10.2 Worker observability (required)
For each job:
- Log `job_type`, `message_id`, `tenant_id`, `outbox_id`, `result`, `duration_ms`
- Increment metrics:
  - processed_total
  - retries_total
  - failures_total

### 10.3 Scheduler observability (recommended)
When scheduling:
- Log schedule creation with:
  - schedule key
  - trigger time
  - outbox id
  - correlation_id
When canceling:
- Log cancellation with schedule key and reason.

---

## 11) Dashboards & alerts (minimal MVP set)

### 11.1 API dashboard
- Request rate (RPS)
- Error rate (4xx/5xx)
- Latency p95/p99 (by route group)
- Top failing routes

### 11.2 Worker dashboard
- Jobs processed rate
- Failure rate
- Retry rate
- DLQ count
- Queue depth (SQS standard metrics)

### 11.3 Business outcome dashboard (MVP)
- Quotes sent vs approved (conversion)
- Invoices sent vs paid
- Reminder sent counts
- Average time from quote sent → approved (optional)

### 11.4 Alerts (MVP)
Alert on:
- API 5xx spike
- Worker failures spike
- DLQ > 0 (immediate alert)
- Queue depth sustained above threshold
- Reminder send failures sustained

---

## 12) Privacy & redaction (required)

Do not store or emit:
- plaintext secure-link tokens
- full addresses/phones/emails in logs or telemetry

Allowed:
- stable internal ids (tenant_id, user_id, client_id)
- masked PII in logs if needed (e.g., `***@domain.com`)

---

## 13) Agent instructions (how to implement in this repo)

When an AI agent adds new features:
1) Add structured logs at key points:
   - start/end of request
   - state transition
   - external token validation
   - outbox enqueue/send
2) Ensure every log line includes:
   - correlation_id
   - tenant_id where applicable
3) Emit telemetry events for user-visible actions in the MVP spine.
4) Add audit events for security-relevant actions.
5) Add metrics counters/timers for new endpoints or worker job types.
6) Never add high-cardinality dimensions (tenant_id) to metrics.

---

## Appendix A — Recommended minimal schemas (optional)

### `telemetry_events` (optional in Postgres)
- `id`
- `tenant_id`
- `event_name`
- `correlation_id`
- `principal_type`
- `principal_id` (nullable)
- `properties` (jsonb)
- `created_at`

### `audit_events` (required)
- `id`
- `tenant_id`
- `principal_type`
- `principal_id`
- `event_name`
- `subject_type`
- `subject_id`
- `correlation_id` (nullable)
- `ip` (nullable)
- `user_agent` (nullable)
- `created_at`

---

## Appendix B — Metric implementation notes (AWS-friendly)

MVP-friendly options:
- Use CloudWatch Embedded Metric Format (EMF) in logs
- Or use CloudWatch metrics directly via library

Keep it simple:
- emit counters and timers
- avoid per-tenant metrics
