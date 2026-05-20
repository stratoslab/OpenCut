# Design: Skill Analysis Fixes

## Overview

Address the top 5 findings from the skill-based codebase analysis: memoize TimelineElement for timeline performance, add a Project Map to AGENTS.md for agent context, split TimelineManager for code clarity, add an error boundary to the editor route for stability, and add a performance budget to CI for regression prevention.

## Architecture

```
apps/web/src/
├── timeline/
│   └── components/
│       └── timeline-element.tsx          # Add React.memo wrapper
├── core/managers/
│   ├── timeline-manager.ts               # Slimmed down (delegates to sub-managers)
│   ├── timeline-commands.ts              # Extracted: command factory/registry
│   ├── timeline-element-ops.ts           # Extracted: element CRUD operations
│   └── timeline-keyframe-ops.ts          # Extracted: keyframe operations
├── app/editor/[project_id]/
│   ├── page.tsx                          # Wrap with ErrorBoundary
│   └── editor-error-boundary.tsx         # New: error boundary component
├── AGENTS.md                             # Add Project Map section
.github/workflows/
└── bun-ci.yml                            # Add bundle size check
```

## Components

### Component 1: TimelineElement Memoization
- **Responsibility:** Prevent unnecessary re-renders of timeline elements
- **Approach:** Wrap `TimelineElement` with `React.memo` and create a custom equality function that compares only the props that affect rendering (element.id, element type, zoomLevel, isSelected)
- **Interface:** `export const MemoizedTimelineElement = React.memo(TimelineElement, areTimelineElementPropsEqual)`
- **Dependencies:** None new

### Component 2: Project Map
- **Responsibility:** Provide agent with quick reference to codebase structure
- **Approach:** Add a "## Project Map" section to AGENTS.md listing 10 major modules
- **Interface:** Markdown section in AGENTS.md
- **Dependencies:** None

### Component 3: TimelineManager Split
- **Responsibility:** Reduce TimelineManager from 935 lines to focused modules
- **Approach:** Extract three sub-modules:
  - `timeline-commands.ts` — Command factory methods (addTrack, insertElement, etc.)
  - `timeline-element-ops.ts` — Element CRUD (updateElement, deleteElements, duplicateElements, visibility/muted toggles)
  - `timeline-keyframe-ops.ts` — Keyframe operations (upsertKeyframe, removeKeyframe, retimeKeyframe, curve updates)
- **Interface:** TimelineManager imports and delegates to sub-modules; public API unchanged
- **Dependencies:** Existing command classes

### Component 4: Editor Error Boundary
- **Responsibility:** Catch JavaScript errors in the editor and show recovery UI
- **Approach:** Create `EditorErrorBoundary` class component wrapping the editor layout. On error, show a panel with error details, "Try Again" button, and "Save Project" link.
- **Interface:** `<EditorErrorBoundary><EditorProvider>...</EditorProvider></EditorErrorBoundary>`
- **Dependencies:** React ErrorBoundary pattern, project save API

### Component 5: CI Performance Budget
- **Responsibility:** Fail CI if production bundle exceeds budget
- **Approach:** Add a post-build step in bun-ci.yml that checks `.next/standalone` and `.next/static` sizes against thresholds
- **Interface:** Bash size check in CI workflow
- **Dependencies:** Existing CI pipeline

## Data Models

No new data models.

## Data Flow

### TimelineManager Split Data Flow
```
Before:
  Caller → TimelineManager (935 lines, 27 command imports) → execute command

After:
  Caller → TimelineManager (thin facade) → delegate to sub-module → execute command
  
TimelineManager.publicMethod() {
  return this.elementOps.method()  // or this.keyframeOps.method()
}
```

### Error Boundary Data Flow
```
Editor renders → Error occurs in child → ErrorBoundary catches → 
  Shows error UI with:
    - Error message and stack
    - "Try Again" (re-mounts children)
    - "Save Project" (triggers project save before reload)
    - "Report Issue" (opens GitHub issues)
```

## Key Algorithms

### TimelineElement Props Equality Check
```typescript
function areTimelineElementPropsEqual(
  prev: TimelineElementProps,
  next: TimelineElementProps,
): boolean {
  return (
    prev.element.id === next.element.id &&
    prev.element.type === next.element.type &&
    prev.track.id === next.track.id &&
    prev.zoomLevel === next.zoomLevel &&
    prev.isSelected === next.isSelected &&
    prev.isDropTarget === next.isDropTarget &&
    prev.dragView === next.dragView
  );
}
```

## Error Handling

- **TimelineManager split:** If extraction breaks existing callers, the public API facade will catch it at compile time (TypeScript errors)
- **Error boundary:** Catches all errors in editor tree; in development, lets React's overlay take precedence
- **Performance budget:** CI fails with clear message showing current size vs. budget; can be overridden with a comment for intentional increases

## Requirements Traceability

| Requirement | Satisfied By |
|-------------|-------------|
| Req 1: Memoize TimelineElement | Component 1 — React.memo with custom equality function |
| Req 2: Add Project Map | Component 2 — Project Map section in AGENTS.md |
| Req 3: Split TimelineManager | Component 3 — Three extracted sub-modules with facade |
| Req 4: Add Error Boundary | Component 4 — EditorErrorBoundary wrapping editor route |
| Req 5: Add Performance Budget | Component 5 — Bundle size check in bun-ci.yml |

## Testing Strategy

- **TimelineElement memoization:** Verify that re-rendering parent does not re-render unchanged children (use React DevTools Profiler or test with render count)
- **TimelineManager split:** Run existing tests (if any) and manually verify all timeline operations still work
- **Error boundary:** Throw a test error in a child component and verify the boundary catches it and shows recovery UI
- **Performance budget:** Intentionally exceed budget in a test PR to verify CI fails with correct message
