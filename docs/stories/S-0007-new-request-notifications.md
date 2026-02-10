# S-0007: New Request Notifications

## Status: Complete

## Checklist

### Phase 1: Domain + Schema + Config + Deps
- [x] Create `domain/entities/message-outbox.ts`
- [x] Add `messageOutbox` table to `schema.ts`
- [x] Add `message_outbox` to TRUNCATE in `reset.ts` and integration `setup.ts`
- [x] Add SMTP config vars to `AppConfig` + `loadConfig()`
- [x] Update `.env` with new vars
- [x] Install `nodemailer` + `@types/nodemailer`
- [x] Run `db:push`

### Phase 2: Ports + Infra
- [x] Create `message-outbox-repository.ts` port
- [x] Create `email-sender.ts` port
- [x] Add `getOwnerByTenantId` to `UserRepository` port
- [x] Implement `getOwnerByTenantId` in `DrizzleUserRepository`
- [x] Create `DrizzleMessageOutboxRepository`
- [x] Create `NodemailerEmailSender`

### Phase 3: Notification Use Case (TDD)
- [x] Write unit tests first (`send-request-notification.test.ts`) — 10 tests
- [x] Create `notification-dto.ts`
- [x] Create `SendRequestNotificationUseCase`

### Phase 4: Wiring
- [x] Wire in `app.ts`
- [x] Update `request-routes.ts` to call notification
- [x] Update integration test setup for new config fields

### Phase 5: Integration Tests
- [x] Add notification integration tests — 4 tests

### Phase 6: Documentation
- [x] Update `CLAUDE.md` with new patterns/decisions
- [x] Update story checklist

## Test Summary
- **Unit tests**: 86 total (76 existing + 10 new notification tests)
- **Integration tests**: 84 total (80 existing + 4 new notification tests)
- **E2E tests**: 39 passing (17 skipped non-desktop) — no regressions
