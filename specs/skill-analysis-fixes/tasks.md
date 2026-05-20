# Tasks: Skill Analysis Fixes

## Overview

Fix the top 5 findings from the skill-based codebase analysis: timeline performance, agent context, code complexity, error recovery, and CI performance budget.

## Task Dependency Graph

```
Task 1 → Task 2 → Task 3 → Task 4 → Task 5
```

## Tasks

- [ ] **Task 1: Memoize TimelineElement component**
  - **What:** Wrap `TimelineElement` with `React.memo` and add a custom props equality function that compares element.id, element.type, track.id, zoomLevel, isSelected, isDropTarget, and dragView
  - **Files:** `apps/web/src/timeline/components/timeline-element.tsx`
  - **Done when:** TimelineElement is exported as a memoized component with a custom equality function, and the component renders identically to before
  - **Depends on:** none

- [ ] **Task 2: Add Project Map to AGENTS.md**
  - **What:** Add a "## Project Map" section to AGENTS.md covering 10 major modules: timeline, editor core, rendering, audio, media, transcription, text, masks, stickers, sounds. Each entry lists key files, responsibilities, and patterns
  - **Files:** `AGENTS.md`
  - **Done when:** AGENTS.md contains a Project Map section with all 10 modules documented
  - **Depends on:** Task 1

- [ ] **Task 3: Split TimelineManager into focused modules**
  - **What:** Extract three sub-modules from TimelineManager (935 lines): `timeline-commands.ts` (command factory methods), `timeline-element-ops.ts` (element CRUD), `timeline-keyframe-ops.ts` (keyframe operations). TimelineManager becomes a thin facade that delegates to sub-modules
  - **Files:** `apps/web/src/core/managers/timeline-manager.ts`, `apps/web/src/core/managers/timeline-commands.ts` (new), `apps/web/src/core/managers/timeline-element-ops.ts` (new), `apps/web/src/core/managers/timeline-keyframe-ops.ts` (new)
  - **Done when:** TimelineManager is under 300 lines, public API is unchanged, no circular dependencies, TypeScript compiles without errors
  - **Depends on:** Task 2

- [ ] **Task 4: Add error boundary to editor route**
  - **What:** Create `EditorErrorBoundary` class component and wrap the editor layout in `apps/web/src/app/editor/[project_id]/page.tsx`. Show recovery UI with error details, "Try Again" button, and "Save Project" link
  - **Files:** `apps/web/src/app/editor/[project_id]/editor-error-boundary.tsx` (new), `apps/web/src/app/editor/[project_id]/page.tsx`
  - **Done when:** Errors in the editor tree are caught and display a recovery UI instead of a white screen
  - **Depends on:** Task 3

- [ ] **Task 5: Add performance budget check to CI**
  - **What:** Add a post-build step in `.github/workflows/bun-ci.yml` that checks production bundle sizes against thresholds. Budget: JS bundle < 500KB, CSS < 100KB, total standalone < 2MB
  - **Files:** `.github/workflows/bun-ci.yml`
  - **Done when:** CI fails with a clear error message when bundle exceeds budget, passes when within budget
  - **Depends on:** Task 4
