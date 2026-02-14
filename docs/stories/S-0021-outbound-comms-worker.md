# S-0021: Outbound Comms Worker

**Status:** Complete
**Branch:** `story/S-0021-outbound-comms-worker`
**Issue:** #35

## Summary

SMS outbox records (created by S-0007's `SendRequestNotificationUseCase`) sat in `queued` status with no worker processing them. This story builds the full delivery pipeline:

1. **Schema changes:** Added `destination` column to `message_outbox`, created `sms_recipient_prefs` table
2. **SMS/SQS adapters:** `SmsSender` port with `StubSmsSender` (local) and `AwsSmsSender` (prod), `SqsMessageQueuePublisher`
3. **Worker:** `MessageJobWorker` with 10-step processing flow (idempotency, crash recovery, opt-out, tenant validation)
4. **Inline poller:** `InlineSqsPoller` long-polls SQS and dispatches to worker
5. **Use case updates:** `SendRequestNotificationUseCase` now resolves SMS destination from `BusinessSettings.phone` and publishes to SQS
6. **CDK:** SQS FIFO queue + DLQ in dev sandbox stack
7. **UI:** Phone hint text below business settings phone input

## Key Decisions

- **FIFO queue** with `MessageGroupId=tenantId` for per-tenant ordering + deduplication
- **Inline worker** (same process as API) via `WORKER_MODE=inline` — separate Lambda worker deferred to prod infra story
- **StubSmsSender** redacts phone (shows only last 4 digits) for PII safety in logs
- **Destination fallback:** Worker can resolve destination from `BusinessSettings.phone` (user) or `Client.phone` (client) if not pre-populated
- **Opt-out check:** `sms_recipient_prefs` table queried before every SMS send
- **MAX_ATTEMPTS=3:** After 3 failures, outbox marked as `failed` with `MAX_ATTEMPTS_EXCEEDED`

## New Tests

- **Unit:** 16 new (13 worker + 3 notification use case)
- **Integration:** 6 new (worker processing, opt-out, idempotency, cross-tenant, request route)
- **E2E:** 1 new (phone hint visible)

## Files Changed

### New Files
- `apps/api/src/domain/entities/sms-recipient-prefs.ts`
- `apps/api/src/application/ports/sms-sender.ts`
- `apps/api/src/application/ports/sms-recipient-prefs-repository.ts`
- `apps/api/src/application/ports/message-queue-publisher.ts`
- `apps/api/src/application/dto/message-job-payload.ts`
- `apps/api/src/application/usecases/message-job-worker.ts`
- `apps/api/src/infra/sms/stub-sms-sender.ts`
- `apps/api/src/infra/sms/aws-sms-sender.ts`
- `apps/api/src/infra/queue/sqs-message-queue-publisher.ts`
- `apps/api/src/infra/queue/noop-message-queue-publisher.ts`
- `apps/api/src/infra/queue/inline-sqs-poller.ts`
- `apps/api/src/infra/db/repositories/drizzle-sms-recipient-prefs-repository.ts`
- `apps/api/test/unit/message-job-worker.test.ts`
- `apps/api/test/integration/worker.test.ts`
- _(`infra/localstack/init-sqs.sh` — later replaced by CDK SQS constructs deployed via `scripts/localstack-deploy.sh`)_

### Modified Files
- `apps/api/src/infra/db/schema.ts` — destination column + sms_recipient_prefs table
- `apps/api/src/domain/entities/message-outbox.ts` — destination field
- `apps/api/src/application/ports/message-outbox-repository.ts` — getById method
- `apps/api/src/infra/db/repositories/drizzle-message-outbox-repository.ts` — getById + destination
- `apps/api/src/shared/config.ts` — 5 new config fields
- `apps/api/src/app.ts` — wire new adapters
- `apps/api/src/index.ts` — start worker when WORKER_MODE=inline
- `apps/api/src/adapters/http/routes/request-routes.ts` — new deps
- `apps/api/src/application/usecases/send-request-notification.ts` — destination + queue publishing
- `apps/api/src/application/usecases/send-quote.ts` — destination field
- `apps/api/src/application/usecases/respond-to-quote.ts` — destination field
- `apps/api/package.json` — @aws-sdk/client-sqs, @aws-sdk/client-pinpoint-sms-voice-v2
- `docker-compose.yml` — SERVICES: s3,sqs,sts,cloudformation,ssm,iam _(init scripts later replaced by CDK deploy)_
- `.env.example` — SMS/SQS/Worker vars
- `infra/cdk/lib/dev-sandbox-stack.ts` — SQS queue + DLQ
- `apps/web/src/components/business-settings/BusinessInfoFields.tsx` — phone hint
- 6 unit test files — makeConfig + outboxRepo mock updates
- `apps/api/test/integration/setup.ts` — truncateAll + makeConfig
