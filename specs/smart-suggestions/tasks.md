# Tasks: Smart Suggestions

## Tasks

- [ ] **Task 1: Create SuggestionQueue**
  - **What:** Priority queue storing suggestions sorted by severity. Add, get next, dismiss operations.
  - **Files:** Create `apps/web-vite/src/smart-suggestions/suggestion-queue.ts`
  - **Done when:** Suggestions added in any order, retrieved by severity priority
  - **Depends on:** none

- [ ] **Task 2: Build SuggestionCard component**
  - **What:** Floating card with severity icon, title, description, Apply/Dismiss buttons, 30s auto-dismiss with hover pause
  - **Files:** Create `apps/web-vite/src/smart-suggestions/components/SuggestionCard.tsx`
  - **Done when:** Card displays correctly, auto-dismiss works, hover pauses timer, buttons work
  - **Depends on:** Task 1

- [ ] **Task 3: Implement suggestion generators**
  - **What:** Analyze project state for common issues: long silences, filler words, inconsistent audio, no subtitles
  - **Files:** Create `apps/web-vite/src/smart-suggestions/generators.ts`
  - **Done when:** Generators produce relevant suggestions based on project state
  - **Depends on:** none

- [ ] **Task 4: Write tests**
  - **What:** PBTs for queue ordering (severity priority), auto-dismiss timer behavior, suggestion generation
  - **Files:** Create `apps/web-vite/src/smart-suggestions/__tests__/suggestion-queue.test.ts`
  - **Done when:** All tests pass
  - **Depends on:** Tasks 1-3
