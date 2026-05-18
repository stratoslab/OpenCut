# Tasks: Command Palette

## Overview

Implement a VS Code-style command palette with fuzzy search, keyboard navigation, and command execution. Pure client-side, no new dependencies.

## Task Dependency Graph

```
Task 1: CommandRegistry ──┬── Task 2: FuzzyMatcher
                          │
                          └── Task 3: CommandPalette UI ── Task 4: Keyboard Integration ── Task 5: PBTs
```

## Tasks

- [ ] **Task 1: Create CommandRegistry**
  - **What:** Central registry that stores all editor commands with metadata (label, category, shortcut, action, availability). Provides `register()`, `getAll()`, and `search()` methods.
  - **Files:** Create `apps/web-vite/src/command-palette/registry.ts`
  - **Done when:** Commands can be registered, retrieved, and filtered by category. All existing editor actions are registered.
  - **Depends on:** none

- [ ] **Task 2: Create FuzzyMatcher**
  - **What:** Pure function that scores command labels against search queries using subsequence matching. Exact match (100) > prefix (80) > contiguous (60) > scattered (40) > no match (0).
  - **Files:** Create `apps/web-vite/src/command-palette/fuzzy-matcher.ts`
  - **Done when:** `match(query, label)` returns correct scores for all matching patterns, case-insensitive
  - **Depends on:** none

- [ ] **Task 3: Build CommandPalette UI**
  - **What:** Modal overlay component with search input, filtered results grouped by category, keyboard shortcut display, and click-to-execute. Opens on Cmd+Shift+P, closes on Escape.
  - **Files:** Create `apps/web-vite/src/command-palette/command-palette.tsx`, add to App.tsx
  - **Done when:** User can open palette, type to filter, see grouped results with shortcuts, click to execute commands
  - **Depends on:** Task 1, Task 2

- [ ] **Task 4: Add Keyboard Navigation**
  - **What:** Arrow key navigation through results, Enter to execute, Escape to close, Cmd+K as alternative shortcut. Focus management for accessibility.
  - **Files:** Update `apps/web-vite/src/command-palette/command-palette.tsx`
  - **Done when:** Full keyboard navigation works: up/down arrows, Enter executes, Escape closes, focus returns to editor
  - **Depends on:** Task 3

- [ ] **Task 5: Write property-based tests**
  - **What:** PBTs for fuzzy matching (subsequence property, case insensitivity, scoring order), command registry completeness, keyboard behavior
  - **Files:** Create `apps/web-vite/src/command-palette/__tests__/fuzzy-matcher.test.ts`, `apps/web-vite/src/command-palette/__tests__/registry.test.ts`
  - **Done when:** All tests pass with 200+ generated cases each
  - **Depends on:** Tasks 1-4
