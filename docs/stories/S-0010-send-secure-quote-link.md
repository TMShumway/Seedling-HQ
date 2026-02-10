# S-0010: Send Secure Quote Link

## Status: Complete

## Overview
Add the secure link system so owners can click "Send Quote" on a draft quote. This generates a secure link, emails it to the client, transitions the quote to `sent` (read-only), and the customer can view the quote at a public URL without logging in. This introduces `secure_link_tokens` as a reusable primitive.

## Key decisions
- Decision: Token hashing — Chosen: HMAC-SHA256 with `SECURE_LINK_HMAC_SECRET` — Why: Security doc 4.3 recommendation
- Decision: Token format — Chosen: `crypto.randomUUID()` raw, HMAC-hashed before storage — Why: 122-bit entropy
- Decision: Default TTL — Chosen: 14 days — Why: Security doc 4.5 recommends 7–14 days
- Decision: External route prefix — Chosen: `/v1/ext/quotes/:token` — Why: Distinct from `/v1/public/` and `/v1/`
- Decision: External auth — Chosen: Separate `externalAuthContext` Fastify decorator — Why: Avoids breaking existing auth type
- Decision: New config vars — Chosen: `APP_BASE_URL`, `SECURE_LINK_HMAC_SECRET` — Why: Required for link construction and hashing

## Phase 1: Domain + Schema + Config + Crypto
- [x] 1.1: Create SecureLinkToken entity
- [x] 1.2: Create hashToken utility + unit tests
- [x] 1.3: Add `secure_link_tokens` table to schema
- [x] 1.4: Add config vars
- [x] 1.5: Update reset.ts and integration setup.ts

## Phase 2: Repository Port + Drizzle Implementation
- [x] 2.1: Create SecureLinkTokenRepository port
- [x] 2.2: Implement DrizzleSecureLinkTokenRepository
- [x] 2.3: Add QuoteRepository.updateStatus

## Phase 3: UoW Extension + Use Case (TDD)
- [x] 3.1: Extend TransactionRepos
- [x] 3.2: Create SendQuoteDTO
- [x] 3.3: Write unit tests first (13 tests)
- [x] 3.4: Implement SendQuoteUseCase
- [x] 3.5: Add event labels

## Phase 4: API Routes (Internal Send + External View)
- [x] 4.1: Create external token middleware
- [x] 4.2: Add POST /v1/quotes/:id/send
- [x] 4.3: Create GET /v1/ext/quotes/:token
- [x] 4.4: Wire in app.ts
- [x] 4.5: Write integration tests (11 tests)

## Phase 5: Frontend — Send Quote + Public View
- [x] 5.1: Add API client methods
- [x] 5.2: Add "Send Quote" flow to QuoteDetailPage
- [x] 5.3: Create PublicQuoteViewPage
- [x] 5.4: Add route to App.tsx

## Phase 6: E2E Tests + Docs
- [x] 6.1: Add seed data for sent quote
- [x] 6.2: Write E2E tests (5 tests)
- [x] 6.3: Update CLAUDE.md + context docs

## Resume context
_(Story complete — no active work)_

## Test summary
- **Unit**: 137 total (22 new: 4 crypto + 13 send-quote + 5 config)
- **Integration**: 118 total (13 new: send-quote-routes)
- **E2E**: 80 total (10 new: 5 desktop + 5 mobile-skipped; 54 run + 26 skipped)
