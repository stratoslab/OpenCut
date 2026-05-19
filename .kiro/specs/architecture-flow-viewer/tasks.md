# Implementation Plan: Architecture Flow Viewer

## Overview

Integrate the existing `docs/architecture-flows.html` standalone diagram into `apps/web` as a first-class Next.js page at `/architecture`. The server component reads and validates `docs/architecture-flows.json` at build time, passes the parsed data to a client-only `FlowViewer` component, and the Header/Footer navigation are updated to include an "Architecture" link.

## Tasks

- [x] 1. Create shared TypeScript types
  - [x] 1.1 Create `apps/web/src/components/architecture/flow-viewer-types.ts`
    - Define and export `ArchNode`, `FlowStep`, `Flow`, `ArchitectureData`, and `PanOffset` interfaces exactly as specified in the design
    - Export layout constants: `NODE_WIDTH=160`, `NODE_HEIGHT=72`, `H_GAP=80`, `V_GAP=24`, `DEFAULT_ZOOM=1.0`, `MIN_ZOOM=0.25`, `MAX_ZOOM=3.0`, `ZOOM_STEP=0.1`, `ZOOM_WHEEL_SENSITIVITY=0.001`
    - Export pure helper functions that will be property-tested: `applyPanDelta(pan, dx, dy)` and `applyResetView(pan, zoom)`
    - _Requirements: 2.2, 3.1_

- [x] 2. Create the server component page
  - [x] 2.1 Create `apps/web/src/app/architecture/page.tsx`
    - Implement `loadArchitectureData()` using `fs.readFileSync` with `path.join(process.cwd(), "docs", "architecture-flows.json")`
    - Catch `readFileSync` errors and re-throw with message `"architecture-flows.json not found"`
    - Catch `JSON.parse` errors and re-throw with message `"architecture-flows.json is invalid JSON"`
    - Validate that `d.version`, `d.nodes`, and `d.flows` are present; throw `"architecture-flows.json is invalid JSON"` if not
    - Export `metadata` with `title: "Architecture - OpenCut"` and `description` of ≤ 155 characters
    - Dynamically import `FlowViewer` with `{ ssr: false }` and render it inside `<BasePage maxWidth="full" mainClassName="px-0 pt-0 pb-0 gap-0">`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 3.3_

- [x] 3. Update Header and Footer navigation
  - [x] 3.1 Modify `apps/web/src/components/header.tsx`
    - Add `{ label: "Architecture", href: "/architecture" }` to the `links` array after the `"Blog"` entry
    - Both desktop nav and mobile menu iterate the same `links` array, so one insertion covers both
    - _Requirements: 4.1, 4.2_

  - [x] 3.2 Modify `apps/web/src/components/footer.tsx`
    - Add `{ label: "Architecture", href: "/architecture" }` to the `resources` array after the `"Blog"` entry
    - _Requirements: 4.3_

- [x] 4. Implement FlowSidebar component
  - [x] 4.1 Create `apps/web/src/components/architecture/flow-sidebar.tsx`
    - Accept props: `flows`, `selectedFlowId`, `collapsedCategories`, `onSelectFlow`, `onToggleCategory`
    - Derive `categories` by grouping `flows` by `flow.category` (preserving insertion order via `reduce`)
    - Render each category as a `<button>` header with `aria-expanded`, `aria-label="Expand/Collapse {category} category"`, and `focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent`
    - When not collapsed, render each flow as a `<button>` with `aria-label="Select {flow.label} flow"`, `aria-pressed`, highlighted background when active, and `data-testid="flow-item-{category}"`
    - _Requirements: 2.1, 2.6, 5.1, 5.3, 5.4_

  - [ ]* 4.2 Write property test for FlowSidebar — Property 3: Category collapse hides all flows
    - **Property 3: Category collapse hides all flows in that category**
    - **Validates: Requirements 2.6**
    - Use `bun:test` with a manual loop (100 iterations) over all categories from a fixture dataset
    - After clicking a category's collapse button, assert `queryAllByTestId("flow-item-{category}").length === 0`
    - After clicking again to expand, assert all flows in that category are visible

  - [ ]* 4.3 Write property test for FlowSidebar — Property 7: Keyboard activation selects the flow
    - **Property 7: Keyboard activation selects the flow**
    - **Validates: Requirements 5.1**
    - Loop over all flows in the fixture dataset (100 iterations)
    - For each flow, render `FlowSidebar`, fire `keyDown` with `{ key: "Enter" }` on the flow's button, assert `onSelectFlow` was called with that flow
    - Repeat with `{ key: " " }` (Space)

  - [ ]* 4.4 Write property test for FlowSidebar — Property 8: Every interactive control has a non-empty aria-label
    - **Property 8: Every interactive control has a non-empty aria-label**
    - **Validates: Requirements 5.4**
    - Render `FlowSidebar` with all categories expanded; query all `<button>` elements
    - Assert every button has a non-empty `aria-label` attribute

- [x] 5. Implement FlowDiagram component
  - [x] 5.1 Create `apps/web/src/components/architecture/flow-diagram.tsx`
    - Accept props: `flow`, `nodes`, `zoom`, `pan`, `onZoomIn`, `onZoomOut`, `onResetView`, `onPanChange`, `onZoomChange`
    - Implement the outer container `div` with `overflow: hidden`, `cursor: grab`, and `data-testid="diagram-canvas"`
    - Implement the inner canvas `div` with `transform: translate({pan.x}px, {pan.y}px) scale({zoom})` and `transform-origin: 0 0`
    - Implement mouse-drag pan: `onMouseDown` records start position, `onMouseMove` computes delta and calls `onPanChange`, `onMouseUp`/`onMouseLeave` clears dragging
    - Implement scroll-wheel zoom: `onWheel` with `{ passive: false }`, adjusts zoom by `delta * ZOOM_WHEEL_SENSITIVITY`, clamps to `[MIN_ZOOM, MAX_ZOOM]`, adjusts pan to zoom toward cursor
    - Implement node layout algorithm: extract unique node IDs in order of first appearance from `flow.steps`, assign depth by first-appearance index, compute `x = depth * (NODE_WIDTH + H_GAP)`, `y = row * (NODE_HEIGHT + V_GAP)`, render each as an absolutely-positioned `div` with `data-testid="node-{id}"`
    - Render a single `<svg>` overlay (`pointer-events: none`) with cubic bezier `<path>` edges and arrowhead markers for each step
    - Render empty state `<p>` with text "Select a workflow from the sidebar" when `flow` is null
    - Render zoom controls overlay (bottom-right): zoom-in `+` button (`aria-label="Zoom in"`), zoom-out `−` button (`aria-label="Zoom out"`), reset button (`aria-label="Reset view"`), all with `focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent`
    - _Requirements: 2.3, 2.5, 2.7, 2.8, 5.2, 5.3, 5.4_

  - [ ]* 5.2 Write property test for FlowDiagram — Property 1: Diagram shows exactly the nodes of the selected flow
    - **Property 1: Diagram shows exactly the nodes of the selected flow**
    - **Validates: Requirements 2.3**
    - Loop over all flows in the fixture dataset (100 iterations)
    - For each flow, render `FlowDiagram`, collect all `data-testid` values matching `node-*` from the diagram canvas
    - Assert the set of rendered node IDs equals exactly `new Set(flow.steps.flatMap(s => [s.from, s.to]))`

  - [ ]* 5.3 Write property test for pure functions — Property 4: Pan offset changes by drag delta
    - **Property 4: Pan offset changes by drag delta**
    - **Validates: Requirements 2.7**
    - Import `applyPanDelta` from `flow-viewer-types.ts`
    - Loop 100 iterations with random `initialPan` and random `dx`/`dy` in `[-500, 500]`
    - Assert `newPan.x === initialPan.x + dx` and `newPan.y === initialPan.y + dy`

  - [ ]* 5.4 Write property test for pure functions — Property 5: Reset view restores default pan and zoom
    - **Property 5: Reset view restores default pan and zoom**
    - **Validates: Requirements 2.8**
    - Import `applyResetView` from `flow-viewer-types.ts`
    - Loop 100 iterations with random pan offsets and zoom values in `[MIN_ZOOM, MAX_ZOOM]`
    - Assert `newPan.x === 0`, `newPan.y === 0`, `newZoom === 1.0`

- [x] 6. Implement FlowDetail component
  - [x] 6.1 Create `apps/web/src/components/architecture/flow-detail.tsx`
    - Accept props: `flow`, `version`
    - Render version badge at top: `<span data-testid="version-badge">v{version}</span>` with badge styling
    - When `flow` is null: render empty-state `<p>` with text "Select a workflow from the sidebar"
    - When `flow` is selected: render flow label as heading, description as subtext, then an ordered list of steps; each step `<li>` has `data-testid="flow-step"` and shows `from → to`, `action` as primary label, `data` as secondary text
    - _Requirements: 2.4, 2.5, 3.4_

  - [ ]* 6.2 Write property test for FlowDetail — Property 2: Detail panel shows steps in order
    - **Property 2: Detail panel shows steps in order for the selected flow**
    - **Validates: Requirements 2.4**
    - Loop over all flows in the fixture dataset (100 iterations)
    - For each flow, render `FlowDetail`, collect all `data-testid="flow-step"` elements
    - Assert `flow.steps.every((step, i) => stepElements[i].textContent?.includes(step.action))`

  - [ ]* 6.3 Write property test for FlowDetail — Property 6: Version badge displays "v" + version string
    - **Property 6: Version badge displays "v" + version string**
    - **Validates: Requirements 3.4**
    - Loop 100 iterations with random non-empty version strings (e.g., `"1.0"`, `"11.0"`, `"2.3.1"`)
    - For each, render `FlowDetail` with `flow={null}` and that version string
    - Assert `getByTestId("version-badge").textContent === "v" + version`

- [x] 7. Implement FlowViewer root component
  - [x] 7.1 Create `apps/web/src/components/architecture/flow-viewer.tsx`
    - Add `"use client"` directive at top
    - Accept `data: ArchitectureData` prop
    - Manage state: `selectedFlow` (`Flow | null`, default `null`), `collapsedCategories` (`Set<string>`, default `new Set()`), `zoom` (default `DEFAULT_ZOOM`), `pan` (default `{ x: 0, y: 0 }`)
    - Implement `useIsDesktop` inline hook using `window.matchMedia("(min-width: 900px)")` (do not reuse `useIsMobile` — it uses 768px breakpoint); render sidebar and detail as `null` when `!isDesktop`
    - Render three-column CSS grid on desktop: `grid-cols-[280px_1fr_320px]`, full-width single column on mobile
    - Render `FlowSidebar`, `FlowDiagram`, and `FlowDetail` as children, passing all state and callbacks as props
    - Render a visually-hidden `aria-live="polite" aria-atomic="true"` region (using `sr-only` class); update its text via `useEffect` on `selectedFlow` change: `"Selected flow: {selectedFlow.label}"` or `""` when null
    - Wire `onZoomIn`/`onZoomOut` using `applyResetView`-style clamping; wire `onResetView` using `applyResetView`; wire `onPanChange` using `applyPanDelta`
    - Diagram area height: `calc(100vh - 64px)` on desktop, `100vh` on mobile
    - _Requirements: 2.1, 2.9, 5.5_

  - [ ]* 7.2 Write property test for FlowViewer — Property 8: Every interactive control has a non-empty aria-label (full viewer)
    - **Property 8: Every interactive control has a non-empty aria-label (full viewer)**
    - **Validates: Requirements 5.4**
    - Loop over all flows in the fixture dataset (100 iterations)
    - For each, render `FlowViewer` with the full `data` fixture, simulate selecting that flow, query all `<button>` elements in the container
    - Assert every button has a non-empty `aria-label`

  - [ ]* 7.3 Write property test for FlowViewer — Property 9: aria-live region reflects selected flow label
    - **Property 9: aria-live region reflects selected flow label**
    - **Validates: Requirements 5.5**
    - Loop over all flows in the fixture dataset (100 iterations)
    - For each, render `FlowViewer`, click the flow's sidebar button, query the `aria-live` region
    - Assert `liveRegion.textContent === "Selected flow: " + flow.label`

- [x] 8. Consolidate property-based tests into single test file
  - [x] 8.1 Create `apps/web/src/__tests__/property-based/architecture-flow-viewer.test.ts`
    - Import `describe`, `it`, `expect` from `bun:test`
    - Import component under test and pure helpers from their respective files
    - Define a shared `fixtureData: ArchitectureData` constant at the top of the file using a minimal inline dataset (3–4 nodes, 2–3 flows across 2 categories) — do NOT read from the real JSON file in tests
    - Consolidate all 9 property tests (Properties 1–9) into this single file, each in its own `it()` block tagged with `// Feature: architecture-flow-viewer, Property {N}: {property_text}`
    - Each property test runs a minimum of 100 iterations
    - _Requirements: 2.3, 2.4, 2.6, 2.7, 2.8, 3.4, 5.1, 5.4, 5.5_

- [ ] 9. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.
  - Verify the build succeeds with `docs/architecture-flows.json` present
  - Verify the build fails with a descriptive error when the JSON file is absent or malformed

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The existing `useIsMobile` hook at `src/hooks/use-mobile.ts` uses a 768 px breakpoint — do NOT reuse it for the 900 px desktop breakpoint; implement `useIsDesktop` inline in `flow-viewer.tsx`
- The project uses `bun:test` for all tests — do NOT add `fast-check` as a dependency; implement property loops manually as shown in existing test files
- All interactive elements must use `focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent` for keyboard focus indicators
- Pure helper functions (`applyPanDelta`, `applyResetView`) are exported from `flow-viewer-types.ts` so they can be tested without rendering
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "3.2", "4.1", "5.1", "6.1"] },
    { "id": 2, "tasks": ["4.2", "4.3", "4.4", "5.2", "5.3", "5.4", "6.2", "6.3", "7.1"] },
    { "id": 3, "tasks": ["7.2", "7.3"] },
    { "id": 4, "tasks": ["8.1"] }
  ]
}
```
