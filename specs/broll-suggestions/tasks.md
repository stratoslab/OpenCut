# Tasks: B-Roll Suggestions

## Tasks

- [ ] **Task 1: Create BrollAnalyzer**
  - **What:** Rule-based transcript analysis detecting proper nouns, action verbs, descriptive phrases. Returns BrollSuggestion[] with timestamps and keywords.
  - **Files:** Create `apps/web-vite/src/broll/broll-analyzer.ts`
  - **Done when:** Given a transcript, returns suggestions distributed across timeline with relevant keywords
  - **Depends on:** none

- [ ] **Task 2: Create PexelsClient**
  - **What:** Client for Pexels API search (photos and videos) with keyword-based queries
  - **Files:** Create `apps/web-vite/src/broll/pexels-client.ts`
  - **Done when:** Search returns results with thumbnails, download URLs, and metadata
  - **Depends on:** none

- [ ] **Task 3: Build BrollSuggestionsPanel**
  - **What:** Panel showing suggestion cards with timestamps, descriptions, search button, Pexels results grid, and "Insert" button
  - **Files:** Create `apps/web-vite/src/broll/components/BrollSuggestionsPanel.tsx`
  - **Done when:** User can view suggestions, search Pexels, insert results into timeline
  - **Depends on:** Tasks 1-2

- [ ] **Task 4: Write tests**
  - **What:** PBTs for suggestion distribution (not clustered), keyword relevance, Pexels search integration
  - **Files:** Create `apps/web-vite/src/broll/__tests__/broll-analyzer.test.ts`
  - **Done when:** All tests pass
  - **Depends on:** Tasks 1-3
