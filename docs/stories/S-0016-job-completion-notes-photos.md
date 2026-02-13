# S-0016: Job Completion with Notes + Photos

## Status: In Progress

## Overview
Technicians need to document their work during visits — adding notes (observations, issues, client requests) and photos (before/after, proof of work). This story adds notes editing endpoints, S3-backed photo upload/view/delete via presigned POST policies, LocalStack for local S3 development, and frontend UI for notes editing, photo management, and a completion confirmation.

## Key decisions
- Decision: Photo storage — Chosen: S3 via presigned POST, LocalStack for local — Why: Same code path dev/prod
- Decision: Upload size enforcement — Chosen: `@aws-sdk/s3-presigned-post` with `content-length-range` — Why: Presigned PUT cannot enforce size limits
- Decision: FileStorage abstraction — Chosen: Port interface in `application/ports/` — Why: Clean architecture; testable via mocks
- Decision: Photo entity — Chosen: Separate `visit_photos` table with `pending`/`ready` lifecycle — Why: Independent CRUD; prevents orphans
- Decision: Serialized quota at confirm — Chosen: `SELECT ... FOR UPDATE` on visit row — Why: Prevents TOCTOU race and over-allocation
- Decision: Completion UX — Chosen: Confirmation alert before completing — Why: User chose independent editing + completion prompt

## Phase 1: Branch + LocalStack Infrastructure
**Goal:** Set up the story branch and LocalStack S3 for local development.
**Files touched:** `docker-compose.yml`, `infra/localstack/init-s3.sh`, `apps/api/src/shared/config.ts`, `.env.example`

- [x] **Task 1.1: Create story branch**
- [ ] **Task 1.2: Add LocalStack to docker-compose**
- [ ] **Task 1.3: Add S3 config vars to AppConfig**

## Phase 2: FileStorage Port + S3 Implementation
**Goal:** Create the storage abstraction and S3 implementation.
**Files touched:** `apps/api/src/application/ports/file-storage.ts`, `apps/api/src/infra/storage/s3-file-storage.ts`, `apps/api/package.json`

- [ ] **Task 2.1: Install AWS S3 SDK packages**
- [ ] **Task 2.2: Create FileStorage port**
- [ ] **Task 2.3: Create S3FileStorage implementation**
- [ ] **Task 2.4: Unit tests for S3FileStorage**

## Phase 3: visit_photos Schema + Entity + Repository
**Goal:** Create the database table and data access layer for visit photos.
**Files touched:** `apps/api/src/infra/db/schema.ts`, `apps/api/src/domain/entities/visit-photo.ts`, `apps/api/src/application/ports/visit-photo-repository.ts`, `apps/api/src/infra/db/repositories/drizzle-visit-photo-repository.ts`

- [ ] **Task 3.1: Add visit_photos table to schema**
- [ ] **Task 3.2: Create VisitPhoto entity**
- [ ] **Task 3.3: Create VisitPhotoRepository port**
- [ ] **Task 3.4: Create DrizzleVisitPhotoRepository**
- [ ] **Task 3.5: Unit tests for DrizzleVisitPhotoRepository**

## Phase 4: Visit Notes Backend
**Goal:** Add the notes update endpoint and use case.
**Files touched:** Various visit-related files

- [ ] **Task 4.1: Add updateNotes to VisitRepository**
- [ ] **Task 4.2: Create UpdateVisitNotesUseCase**
- [ ] **Task 4.3: Add PATCH /v1/visits/:id/notes route**
- [ ] **Task 4.4: Unit tests for UpdateVisitNotesUseCase**

## Phase 5: Photo Upload/List/Delete/Confirm Backend
**Goal:** Add photo CRUD endpoints with presigned POST upload.
**Files touched:** Various use case and route files

- [ ] **Task 5.1: Add fileStorage to CreateAppOptions and wire into app.ts**
- [ ] **Task 5.2: Create CreateVisitPhotoUseCase**
- [ ] **Task 5.3: Create ConfirmVisitPhotoUseCase**
- [ ] **Task 5.4: Create ListVisitPhotosUseCase**
- [ ] **Task 5.5: Create DeleteVisitPhotoUseCase**
- [ ] **Task 5.6: Create visit photo routes**
- [ ] **Task 5.7: Unit tests for photo use cases**

## Phase 6: Backend Integration Tests
**Goal:** Integration tests for notes and photos with real DB, mocked FileStorage.

- [ ] **Task 6.1: Update truncateAll in integration setup**
- [ ] **Task 6.2: Integration tests for visit notes**
- [ ] **Task 6.3: Integration tests for visit photos**

## Phase 7: Frontend — API Client + Visit Notes UI
- [ ] **Task 7.1: Add API client methods**
- [ ] **Task 7.2: Add notes editing to TodayVisitCard**
- [ ] **Task 7.3: Enhance JobDetailPage visit cards with notes display**
- [ ] **Task 7.4: Web unit tests for notes UI**

## Phase 8: Frontend — Photo Upload + Gallery UI
- [ ] **Task 8.1: Create PhotoUpload component**
- [ ] **Task 8.2: Create PhotoGallery component**
- [ ] **Task 8.3: Integrate photos into TodayVisitCard**
- [ ] **Task 8.4: Integrate photos into JobDetailPage**
- [ ] **Task 8.5: Web unit tests for photo components**

## Phase 9: Frontend — Completion Confirmation
- [ ] **Task 9.1: Add completion confirmation to TodayVisitCard**
- [ ] **Task 9.2: Add completion confirmation to JobDetailPage VisitActions**
- [ ] **Task 9.3: Web unit tests for completion confirmation**

## Phase 10: E2E Tests
- [ ] **Task 10.1: Add LocalStack health check to E2E globalSetup**
- [ ] **Task 10.2: E2E tests for visit notes + completion**
- [ ] **Task 10.4: E2E tests for visit photos**

## Phase 11: Seed Data + Documentation
- [ ] **Task 11.1: Seed dedicated E2E visits for notes + photos**
- [ ] **Task 11.2: Update CLAUDE.md**
- [ ] **Task 11.3: Update context docs**
- [ ] **Task 11.4: Finalize story file**

## Resume context
### Last completed
- Task 1.1: Created story branch
### In progress
- Starting Phase 1 remaining tasks
### Next up
- Task 1.2: Add LocalStack to docker-compose
### Blockers / open questions
- None

## Test summary
- **Unit**: 0 new
- **Integration**: 0 new
- **E2E**: 0 new
