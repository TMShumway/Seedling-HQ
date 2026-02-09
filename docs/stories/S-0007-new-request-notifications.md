# S-0007: New Request Notifications

## Checklist

### Phase 1: Domain + Schema + Config + Deps
- [ ] Create `domain/entities/message-outbox.ts`
- [ ] Add `messageOutbox` table to `schema.ts`
- [ ] Add `message_outbox` to TRUNCATE in `reset.ts` and integration `setup.ts`
- [ ] Add SMTP config vars to `AppConfig` + `loadConfig()`
- [ ] Update `.env` with new vars
- [ ] Install `nodemailer` + `@types/nodemailer`
- [ ] Run `db:push`

### Phase 2: Ports + Infra
- [ ] Create `message-outbox-repository.ts` port
- [ ] Create `email-sender.ts` port
- [ ] Add `getOwnerByTenantId` to `UserRepository` port
- [ ] Implement `getOwnerByTenantId` in `DrizzleUserRepository`
- [ ] Create `DrizzleMessageOutboxRepository`
- [ ] Create `NodemailerEmailSender`

### Phase 3: Notification Use Case (TDD)
- [ ] Write unit tests first (`send-request-notification.test.ts`)
- [ ] Create `notification-dto.ts`
- [ ] Create `SendRequestNotificationUseCase`

### Phase 4: Wiring
- [ ] Wire in `app.ts`
- [ ] Update `request-routes.ts` to call notification
- [ ] Update integration test setup for new config fields

### Phase 5: Integration Tests
- [ ] Add notification integration tests

### Phase 6: Documentation
- [ ] Update `CLAUDE.md` with new patterns/decisions
- [ ] Update context docs as needed
