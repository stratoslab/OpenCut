# Requirements: Skill Analysis Fixes

## Introduction

Fix the top 5 issues identified by the skill-based codebase analysis: performance bottlenecks in the timeline, missing context engineering documentation, code complexity in TimelineManager, lack of error boundaries, and no performance budget in CI.

## Glossary

| Term | Definition |
|------|-----------|
| **TimelineElement** | The React component that renders each clip/block on the timeline |
| **TimelineManager** | The 935-line manager class handling all timeline operations |
| **Error Boundary** | React component that catches JavaScript errors in its child tree |
| **Performance Budget** | Thresholds for bundle size, load time, and Core Web Vitals enforced in CI |
| **Project Map** | A summary index of major codebase modules for agent context |
| **React.memo** | React optimization that prevents re-renders when props haven't changed |

## Requirements

### Requirement 1: Memoize TimelineElement Component

**User Story:** As a user editing video, I want the timeline to stay smooth when I make changes so that I don't experience lag or jank.

#### Acceptance Criteria

1. WHEN the timeline re-renders THEN TimelineElement components SHALL NOT re-render unless their specific props change
2. IF a TimelineElement's element data changes THEN only that element SHALL re-render
3. WHEN zooming or panning THEN elements SHALL re-render efficiently without unnecessary work

#### Correctness Properties

- **Property 1:** Re-rendering a single element SHALL NOT cause sibling elements to re-render
- **Property 2:** The visual output of TimelineElement SHALL be identical before and after memoization

### Requirement 2: Add Project Map to AGENTS.md

**User Story:** As a developer working on the codebase, I want an agent to understand the project structure quickly so that it doesn't waste time exploring files from scratch each session.

#### Acceptance Criteria

1. WHEN an agent starts a session THEN it SHALL have access to a Project Map summary
2. IF the agent works on a specific module THEN it SHALL know which files are relevant
3. WHEN the agent encounters ambiguity THEN it SHALL reference the Project Map for context

#### Correctness Properties

- **Property 1:** The Project Map SHALL cover all major modules (timeline, editor, rendering, audio, media, transcription, text, masks, stickers, sounds)
- **Property 2:** Each module entry SHALL list key files, responsibilities, and known patterns

### Requirement 3: Split TimelineManager

**User Story:** As a developer modifying timeline behavior, I want the TimelineManager to be focused and readable so that I can find and change the right code without breaking unrelated functionality.

#### Acceptance Criteria

1. WHEN TimelineManager is split THEN each new module SHALL have a single responsibility
2. IF a command group is extracted THEN it SHALL be importable independently
3. WHEN the split is complete THEN no existing behavior SHALL change

#### Correctness Properties

- **Property 1:** Each extracted module SHALL be under 300 lines
- **Property 2:** The public API of TimelineManager SHALL remain unchanged (all existing callers work)
- **Property 3:** No circular dependencies SHALL be introduced between extracted modules

### Requirement 4: Add Error Boundary to Editor Route

**User Story:** As a user editing a project, I want the app to recover gracefully from errors so that I don't lose my work or see a white screen.

#### Acceptance Criteria

1. WHEN a JavaScript error occurs in the editor THEN an error boundary SHALL catch it
2. IF an error is caught THEN the user SHALL see a helpful error state with recovery options
3. WHEN the error boundary triggers THEN the error SHALL be logged with context

#### Correctness Properties

- **Property 1:** The error boundary SHALL NOT catch errors in development mode (let React overlay handle them)
- **Property 2:** The error boundary SHALL preserve the user's project state (not clear it)

### Requirement 5: Add Performance Budget to CI

**User Story:** As a maintainer, I want CI to enforce performance budgets so that the bundle doesn't grow unchecked over time.

#### Acceptance Criteria

1. WHEN a PR increases bundle size beyond the budget THEN CI SHALL fail
2. IF the bundle is within budget THEN CI SHALL pass
3. WHEN the budget is exceeded THEN the error message SHALL show current vs. allowed size

#### Correctness Properties

- **Property 1:** The budget check SHALL run on the production build output
- **Property 2:** The budget values SHALL be based on current measured sizes (not arbitrary targets)
