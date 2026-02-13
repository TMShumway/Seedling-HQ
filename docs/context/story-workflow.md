# Story Implementation Workflow

> Process and template for story-driven development.
> Linked from [CLAUDE.md](../../CLAUDE.md).

Every story gets a **story-specific markdown file** in `docs/stories/S-XXXX-<short-name>.md`. This file is the single source of truth for the story's plan, progress, and resumption context. It must be kept up to date during both planning and implementation.

## Story file template

```markdown
# S-XXXX: <Title>

## Status: Planning | In Progress | Blocked | Complete

## Overview
<!-- 2-3 sentence summary of what this story delivers and why -->

## Key decisions
<!-- Architectural/design choices that affect implementation -->
- Decision: <what> — Chosen: <choice> — Why: <rationale>

## Phase 1: <Phase Name>
**Goal:** <What this phase achieves>
**Files touched:** `path/to/file.ts`, `path/to/other.ts`

- [ ] **Task 1.1: <Imperative title>**
  - Acceptance: <How to verify this is done>
  - [ ] Subtask: <specific step>
  - [ ] Subtask: <specific step>
- [ ] **Task 1.2: <Imperative title>**
  - Acceptance: <How to verify this is done>

## Phase 2: ...

## Resume context
<!-- Updated after each work session, before compaction, or when handing off -->
### Last completed
- <What was just finished, with file paths>
### In progress
- <What is currently being worked on, partial state details>
- Current file: `path/to/file.ts` — <what was done, what remains>
### Next up
- <Next task to pick up>
### Blockers / open questions
- <Anything unresolved>

## Test summary
<!-- Updated as tests are written -->
- **Unit**: X total (Y new)
- **Integration**: X total (Y new)
- **E2E**: X total (Y new)
```

## Structure rules

1. **Decompose aggressively.** Every phase should have 2-6 tasks. If a task has more than 3 subtasks, consider splitting it into its own task. Any single task should be completable in one focused session without losing context.
2. **Files touched per phase.** List every file that will be created or modified so anyone jumping in knows exactly where to look.
3. **Acceptance criteria on every task.** Not just "create X" — state how to verify it's correct (e.g., "unit tests pass", "route returns 200 with expected shape", "page renders with seeded data").
4. **Key decisions up front.** Record architectural choices during planning so implementation doesn't stall on ambiguity. Add new decisions as they arise during implementation.
5. **Resume context is mandatory.** This section must be updated before ending a session, when context is getting long, or before any handoff. It should contain enough detail that a fresh Claude instance or a teammate can continue without re-reading the entire conversation.

## Workflow

1. **Start of story:** Read the story file. If it doesn't exist, create it using the template above (plan mode or not). Set status to `Planning` or `In Progress`.
2. **Check resume context:** If the "Resume context" section is populated, start from where it left off rather than scanning all checkboxes.
3. **Work through tasks:** Find the first unchecked item, complete it, mark it `[x]`.
4. **Record problems:** If a step fails or needs adjustment, note it in the story file before continuing.
5. **Keep resume context fresh:** Before context gets long, before ending a session, or before any handoff, update the "Resume context" section with:
   - What was just completed (with file paths)
   - What is partially done (with specific details about current state)
   - What to do next
   - Any blockers or open questions
6. **Commit after each phase:** When a phase is complete, use the Task tool (subagent) to create a commit. The subagent must:
   - Read the current story file (`docs/stories/S-XXXX-*.md`) for phase context
   - Run `git diff HEAD` to see what changed since the last commit
   - Run `git log -1 --stat` to see the previous commit's scope for comparison
   - Run `git log --oneline -5` to match existing commit message style
   - Stage all relevant files (`git add` specific files, not `-A`)
   - Write a commit message that references the story and phase (e.g., `S-0009 phase 2: Add QuoteRepository port and Drizzle implementation`)
   - The commit message body should briefly list what was done in the phase
   - Do NOT push to remote — only commit locally
7. **Finish:** After all phases complete, set status to `Complete` and clear the "Resume context" section.
