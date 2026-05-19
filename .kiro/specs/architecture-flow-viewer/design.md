# Design Document: Architecture Flow Viewer

## Overview

The Architecture Flow Viewer integrates the existing standalone `docs/architecture-flows.html` diagram into the `apps/web` Next.js application as a first-class page at `/architecture`. The page is statically generated at build time — the server component reads `docs/architecture-flows.json` via `fs.readFileSync`, validates it, and passes the parsed data as props to a client-only `FlowViewer` component.

The viewer renders a three-panel layout: a collapsible-category sidebar for flow selection, a central SVG/CSS-transform diagram area with pan/zoom, and a detail panel showing step-by-step descriptions. Header and Footer navigation are updated to include an "Architecture" link.

### Key Design Decisions

- **Server component reads JSON, client component renders UI.** This keeps the data loading simple (no `fetch`, no `getStaticProps` boilerplate) while ensuring the browser-only pan/zoom interactions stay in a `"use client"` component.
- **CSS transform pan/zoom over SVG viewBox manipulation.** A single `transform: translate(x,y) scale(z)` on a container `<div>` is simpler to implement, performs well, and avoids SVG coordinate system complexity.
- **No external diagram library.** The existing HTML prototype uses plain SVG with absolute positioning. We replicate this approach to avoid adding a heavy dependency (e.g., React Flow, D3) for a relatively simple static diagram.
- **Build-time validation throws.** If the JSON is missing or malformed, `fs.readFileSync` / `JSON.parse` throw synchronously inside the page module, which causes Next.js to fail the build with a non-zero exit code and a descriptive error message.


## Architecture

### Component Hierarchy

```
app/architecture/page.tsx          (Server Component)
  └── FlowViewer                   (Client Component, dynamic ssr:false)
        ├── FlowSidebar            (Client Component)
        │     └── CategoryGroup[]  (inline, collapsible)
        │           └── FlowItem[] (button per flow)
        ├── FlowDiagram            (Client Component)
        │     ├── DiagramCanvas    (pan/zoom container div)
        │     │     ├── NodeCard[] (positioned divs)
        │     │     └── EdgeSVG    (SVG overlay for arrows)
        │     └── DiagramControls  (zoom-in, zoom-out, reset)
        └── FlowDetail             (Client Component)
              ├── VersionBadge
              └── StepList[]
```

### Data Flow

```
docs/architecture-flows.json
  │
  │  (fs.readFileSync at build time — server component)
  ▼
page.tsx  →  validates JSON shape  →  throws on error (fails build)
  │
  │  passes ArchitectureData as prop
  ▼
FlowViewer (client)
  │
  ├── FlowSidebar  receives: flows[], nodes{}
  ├── FlowDiagram  receives: selectedFlow | null, nodes{}
  └── FlowDetail   receives: selectedFlow | null, version
```

State lives entirely in `FlowViewer` and is passed down as props. No context or global store is needed — the component tree is shallow enough that prop drilling is clean.


## Components and Interfaces

### `flow-viewer-types.ts`

Shared TypeScript types used across all architecture components.

```typescript
export interface ArchNode {
  id: string;
  label: string;
  type: string;
  icon: string;
  description: string;
  package?: string;
}

export interface FlowStep {
  from: string;
  to: string;
  action: string;
  data: string;
}

export interface Flow {
  id: string;
  label: string;
  category: string;
  description: string;
  steps: FlowStep[];
}

export interface ArchitectureData {
  version: string;
  description: string;
  nodes: Record<string, ArchNode>;
  flows: Flow[];
}

export interface PanOffset {
  x: number;
  y: number;
}
```

### `page.tsx` — Server Component

```typescript
import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { BasePage } from "@/app/base-page";
import type { ArchitectureData } from "@/components/architecture/flow-viewer-types";

export const metadata: Metadata = {
  title: "Architecture - OpenCut",
  description:
    "Explore the interactive OpenCut architecture diagram — nodes, flows, and component relationships across the codebase.",
};

// Load and validate at build time; throws → build fails with descriptive message
function loadArchitectureData(): ArchitectureData {
  const jsonPath = path.join(process.cwd(), "docs", "architecture-flows.json");

  let raw: string;
  try {
    raw = fs.readFileSync(jsonPath, "utf-8");
  } catch {
    throw new Error("architecture-flows.json not found");
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("architecture-flows.json is invalid JSON");
  }

  // Basic shape validation
  const d = data as ArchitectureData;
  if (!d.version || !d.nodes || !d.flows) {
    throw new Error("architecture-flows.json is invalid JSON");
  }

  return d;
}

const FlowViewer = dynamic(
  () => import("@/components/architecture/flow-viewer"),
  { ssr: false }
);

export default function ArchitecturePage() {
  const data = loadArchitectureData();
  return (
    <BasePage maxWidth="full" mainClassName="px-0 pt-0 pb-0 gap-0">
      <FlowViewer data={data} />
    </BasePage>
  );
}
```


### `flow-viewer.tsx` — Main Client Component

```typescript
"use client";

interface FlowViewerProps {
  data: ArchitectureData;
}

// State managed here, passed down as props
// selectedFlow: Flow | null
// collapsedCategories: Set<string>
// zoom: number          (default: 1.0, min: 0.25, max: 3.0)
// pan: PanOffset        (default: { x: 0, y: 0 })
```

**State:**

| State | Type | Default | Description |
|---|---|---|---|
| `selectedFlow` | `Flow \| null` | `null` | Currently selected flow |
| `collapsedCategories` | `Set<string>` | `new Set()` | Category IDs that are collapsed |
| `zoom` | `number` | `1.0` | Diagram zoom level |
| `pan` | `PanOffset` | `{ x: 0, y: 0 }` | Diagram pan offset in pixels |

**Layout:** Three-column CSS grid on desktop (`grid-cols-[280px_1fr_320px]`), single column on mobile (sidebar and detail hidden, diagram full-width). Breakpoint: 900 px via Tailwind `md:` prefix configured at `900px` or using inline style/class.

**aria-live region:** A visually-hidden `<div aria-live="polite" aria-atomic="true">` is rendered inside FlowViewer and updated with `"Selected flow: {flow.label}"` whenever `selectedFlow` changes.

### `flow-sidebar.tsx`

```typescript
interface FlowSidebarProps {
  flows: Flow[];
  selectedFlowId: string | null;
  collapsedCategories: Set<string>;
  onSelectFlow: (flow: Flow) => void;
  onToggleCategory: (category: string) => void;
}
```

**Rendering logic:**
1. Derive `categories` by grouping `flows` by `flow.category` (preserving insertion order).
2. For each category, render a `<button>` header with `aria-expanded` and `aria-label="Expand/Collapse {category} category"`.
3. When not collapsed, render each flow as a `<button>` with `aria-label="Select {flow.label} flow"` and `aria-pressed={flow.id === selectedFlowId}`.
4. Active flow button gets a highlighted background (`bg-accent/20` or similar).

### `flow-diagram.tsx`

```typescript
interface FlowDiagramProps {
  flow: Flow | null;
  nodes: Record<string, ArchNode>;
  zoom: number;
  pan: PanOffset;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onPanChange: (pan: PanOffset) => void;
  onZoomChange: (zoom: number) => void;
}
```

**Pan/Zoom implementation:**

The diagram area is a fixed-size container `div` with `overflow: hidden` and `cursor: grab`. Inside it, a single "canvas" `div` receives the CSS transform:

```css
transform: translate({pan.x}px, {pan.y}px) scale({zoom});
transform-origin: 0 0;
```

- **Mouse drag pan:** `onMouseDown` sets a `isDragging` ref and records `startX/startY`. `onMouseMove` computes delta and calls `onPanChange`. `onMouseUp` / `onMouseLeave` clears dragging state.
- **Scroll zoom:** `onWheel` (with `{ passive: false }` to call `preventDefault`) adjusts zoom by `delta * 0.001`, clamped to `[0.25, 3.0]`. Zoom is centered on the cursor position by adjusting pan offset: `newPan.x = cursorX - (cursorX - pan.x) * (newZoom / zoom)`.
- **Keyboard zoom:** `onZoomIn` adds `0.1`, `onZoomOut` subtracts `0.1`, both clamped.
- **Reset:** Sets `zoom = 1.0`, `pan = { x: 0, y: 0 }`.

**Node layout:** Nodes are positioned using a simple left-to-right layout algorithm. The active flow's steps define a sequence of `from → to` pairs. Unique node IDs are extracted in order of first appearance. Nodes are laid out in a grid: columns represent "depth" (position in the sequence), rows handle multiple nodes at the same depth. Each node is an absolutely-positioned `div` inside the canvas div.

**Edge rendering:** A single `<svg>` element is absolutely positioned over the canvas div (same size, `pointer-events: none`). For each step, a curved path (`<path>` with cubic bezier) is drawn from the center-right of the `from` node to the center-left of the `to` node, with an arrowhead marker.

**Empty state:** When `flow` is null, renders a centered `<p>` with text "Select a workflow from the sidebar".

**Controls:** Three `<button>` elements rendered in a fixed position overlay (bottom-right of the diagram container):
- Zoom in (`+`), `aria-label="Zoom in"`
- Zoom out (`−`), `aria-label="Zoom out"`
- Reset view, `aria-label="Reset view"`

All three are reachable via Tab navigation (no `tabIndex=-1`).

### `flow-detail.tsx`

```typescript
interface FlowDetailProps {
  flow: Flow | null;
  version: string;
}
```

Renders:
1. A version badge at the top: `<span>v{version}</span>` with badge styling.
2. When `flow` is null: empty-state placeholder "Select a workflow from the sidebar".
3. When `flow` is selected: flow label as heading, description as subtext, then an ordered list of steps. Each step shows `from → to`, the `action` as the primary label, and `data` as secondary text.


## Data Models

### JSON Shape (from `docs/architecture-flows.json`)

The JSON is read as-is and typed via `ArchitectureData`. No transformation is applied — the raw parsed object is passed directly to `FlowViewer` as a prop.

### Derived State

**Category grouping** (computed in `FlowSidebar`, not stored in state):

```typescript
const categories = flows.reduce<Record<string, Flow[]>>((acc, flow) => {
  if (!acc[flow.category]) acc[flow.category] = [];
  acc[flow.category].push(flow);
  return acc;
}, {});
```

**Active node IDs** (computed in `FlowDiagram`, not stored in state):

```typescript
const activeNodeIds = flow
  ? Array.from(new Set(flow.steps.flatMap((s) => [s.from, s.to])))
  : [];
```

**Node layout positions** (computed in `FlowDiagram`):

```typescript
// Assign depth = index of first appearance in the step sequence
// Layout: nodeX = depth * (NODE_WIDTH + H_GAP), nodeY = row * (NODE_HEIGHT + V_GAP)
```

### Constants

```typescript
const NODE_WIDTH = 160;
const NODE_HEIGHT = 72;
const H_GAP = 80;   // horizontal gap between columns
const V_GAP = 24;   // vertical gap between rows
const DEFAULT_ZOOM = 1.0;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.1;
const ZOOM_WHEEL_SENSITIVITY = 0.001;
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

**Property Reflection:** After prework analysis, the following properties were identified as testable. Properties 2.3 and 2.4 (diagram update and detail update on flow selection) are closely related but test different output surfaces (diagram node set vs. step order), so both are retained. Properties 5.1 and 5.5 both involve flow selection but test different outputs (state change vs. aria-live text), so both are retained. Properties 4.1/4.3 (header/footer links) are example-based, not properties. No redundancy was found among the universal properties.

---

### Property 1: Diagram shows exactly the nodes of the selected flow

*For any* flow in the architecture data, after selecting that flow, the set of node IDs rendered in the Diagram_Area SHALL equal exactly the set of unique node IDs referenced in that flow's steps (the union of all `from` and `to` values), with no additional nodes and no missing nodes.

**Validates: Requirements 2.3**

---

### Property 2: Detail panel shows steps in order for the selected flow

*For any* flow in the architecture data, after selecting that flow, the Detail_Panel SHALL display the flow's steps in the same order as they appear in the `steps` array, with each step's `action` and `data` values present in the rendered output.

**Validates: Requirements 2.4**

---

### Property 3: Category collapse hides all flows in that category

*For any* category in the architecture data, when that category is collapsed, none of the flows belonging to that category SHALL be visible in the Sidebar; when expanded, all flows in that category SHALL be visible.

**Validates: Requirements 2.6**

---

### Property 4: Pan offset changes by drag delta

*For any* initial pan offset and any mouse drag delta (dx, dy), after the drag interaction completes, the new pan offset SHALL equal `{ x: initialPan.x + dx, y: initialPan.y + dy }`.

**Validates: Requirements 2.7**

---

### Property 5: Reset view restores default pan and zoom

*For any* pan offset and zoom level, after activating the Reset View control, the pan offset SHALL be `{ x: 0, y: 0 }` and the zoom level SHALL be `1.0`.

**Validates: Requirements 2.8**

---

### Property 6: Version badge displays "v" + version string

*For any* version string in the architecture data, the rendered version badge SHALL contain the text `"v"` concatenated with that version string (e.g., version `"11.0"` → badge text `"v11.0"`).

**Validates: Requirements 3.4**

---

### Property 7: Keyboard activation selects the flow

*For any* flow item rendered in the Sidebar, pressing Enter or Space while that item has focus SHALL update the selected flow state to that flow, which SHALL in turn update both the Diagram_Area and the Detail_Panel.

**Validates: Requirements 5.1**

---

### Property 8: Every interactive control has a non-empty aria-label

*For any* interactive control rendered in the Flow_Viewer (sidebar category headers, sidebar flow buttons, zoom-in, zoom-out, reset view), the element SHALL have an `aria-label` attribute whose value is a non-empty string that uniquely identifies the control's action.

**Validates: Requirements 5.4**

---

### Property 9: aria-live region reflects selected flow label

*For any* flow in the architecture data, after selecting that flow, the `aria-live="polite"` region SHALL contain the text `"Selected flow: "` concatenated with that flow's `label` value.

**Validates: Requirements 5.5**


## Error Handling

### Build-Time Errors

Both error conditions are handled in `loadArchitectureData()` inside `page.tsx`. The function is called at module evaluation time (top-level in the server component), so any thrown error propagates to the Next.js build process and causes a non-zero exit.

| Condition | Error message | Mechanism |
|---|---|---|
| JSON file missing | `"architecture-flows.json not found"` | `fs.readFileSync` throws; caught and re-thrown with this message |
| Invalid JSON | `"architecture-flows.json is invalid JSON"` | `JSON.parse` throws; caught and re-thrown with this message |
| Missing required fields | `"architecture-flows.json is invalid JSON"` | Shape check throws with same message |

### Runtime Errors

- **Unknown node ID in a flow step:** If a step references a node ID not present in `nodes`, the diagram renders the node as a fallback card with the raw ID and a `?` icon. This is a data quality issue, not a crash.
- **Empty flows array:** The sidebar renders an empty state "No flows available". The diagram and detail panel show the "Select a workflow" placeholder.
- **Zoom clamping:** Zoom is always clamped to `[MIN_ZOOM, MAX_ZOOM]` before being applied to state, preventing runaway values.

### Header/Footer Modification

Both modifications are additive array insertions — no existing entries are removed or reordered.

**`header.tsx`:** Add `{ label: "Architecture", href: "/architecture" }` to the `links` array after `"Blog"`. Both the desktop nav and mobile menu iterate the same `links` array, so one change covers both (Requirement 4.1 and 4.2).

**`footer.tsx`:** Add `{ label: "Architecture", href: "/architecture" }` to the `resources` array after `"Blog"` (Requirement 4.3).


## Responsive Behavior

The three-panel layout uses a CSS grid. On desktop (≥ 900 px) the grid is `280px 1fr 320px`. Below 900 px, the sidebar and detail panel are hidden (`hidden md:block` with a custom breakpoint, or `@media (max-width: 899px)` via Tailwind config or inline style) and the diagram takes full width.

Since Tailwind's default `md` breakpoint is 768 px, and the requirement specifies 900 px, the implementation uses either:
- A custom Tailwind breakpoint `arch: '900px'` in `tailwind.config.ts`, or
- Inline conditional rendering based on a `useWindowSize` hook that reads `window.innerWidth`.

The inline hook approach is simpler and avoids touching the Tailwind config. The hook returns `isDesktop: boolean` (true when width ≥ 900), and the sidebar/detail panel render `null` when `!isDesktop`.

**Diagram height:** On desktop, the diagram area fills the viewport height minus the header (`calc(100vh - 64px)`). On mobile, it fills the full viewport height.


## Accessibility Implementation

### Keyboard Navigation

- All sidebar category headers are `<button>` elements — naturally focusable and activatable with Enter/Space.
- All sidebar flow items are `<button>` elements — same.
- Diagram controls (zoom-in, zoom-out, reset) are `<button>` elements in the natural tab order.
- The diagram canvas `div` itself does not receive focus (it's a mouse-only interaction surface). Keyboard users can still select flows and use the zoom controls.

### ARIA Attributes

| Element | Attribute | Value |
|---|---|---|
| Category header button | `aria-expanded` | `"true"` / `"false"` |
| Category header button | `aria-label` | `"Expand {category} category"` / `"Collapse {category} category"` |
| Flow item button | `aria-label` | `"Select {flow.label} flow"` |
| Flow item button | `aria-pressed` | `"true"` when selected |
| Zoom-in button | `aria-label` | `"Zoom in"` |
| Zoom-out button | `aria-label` | `"Zoom out"` |
| Reset view button | `aria-label` | `"Reset view"` |
| aria-live region | `aria-live` | `"polite"` |
| aria-live region | `aria-atomic` | `"true"` |

### Focus Indicators

All interactive elements use Tailwind's `focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent` classes to provide a visible 2 px ring on keyboard focus without showing the ring on mouse click (via `:focus-visible`).

### Screen Reader Announcements

The `aria-live` region is a visually-hidden `<div>` (using `sr-only` class or equivalent `position: absolute; width: 1px; height: 1px; overflow: hidden`). Its text content is updated via React state whenever `selectedFlow` changes:

```typescript
const [announcement, setAnnouncement] = useState("");
useEffect(() => {
  if (selectedFlow) {
    setAnnouncement(`Selected flow: ${selectedFlow.label}`);
  }
}, [selectedFlow]);
```


## Testing Strategy

### Unit Tests (example-based)

These cover specific scenarios, configuration checks, and error conditions.

- **`loadArchitectureData` — missing file:** Mock `fs.readFileSync` to throw; assert the caught error message contains `"architecture-flows.json not found"`.
- **`loadArchitectureData` — invalid JSON:** Mock `fs.readFileSync` to return `"not json"`; assert the caught error message contains `"architecture-flows.json is invalid JSON"`.
- **`page.tsx` metadata:** Assert `metadata.title === "Architecture - OpenCut"` and `metadata.description.length <= 155`.
- **`FlowViewer` empty state:** Render with no flow selected; assert both diagram and detail panel contain "Select a workflow from the sidebar".
- **`FlowViewer` responsive:** Render with `window.innerWidth = 800`; assert sidebar and detail panel are not rendered.
- **`FlowSidebar` link presence:** Render Header; assert an anchor with `href="/architecture"` and text "Architecture" is present.
- **`Footer` link presence:** Render Footer; assert an anchor with `href="/architecture"` and text "Architecture" is in the resources section.
- **Zoom controls keyboard:** Render diagram controls; simulate Enter on zoom-in button; assert zoom state increases.

### Property-Based Tests

Property-based testing is appropriate here because the feature has several universal properties that hold across all flows, categories, and version strings in the dataset. The input space (all flows, all categories, all version strings) is finite but large enough that exhaustive manual testing is impractical.

**Library:** [fast-check](https://github.com/dubzzz/fast-check) (TypeScript-native, works with Vitest/Jest).

**Configuration:** Each property test runs a minimum of 100 iterations.

**Tag format:** Each test is tagged with a comment: `// Feature: architecture-flow-viewer, Property {N}: {property_text}`

---

**Property 1: Diagram shows exactly the nodes of the selected flow**

```typescript
// Feature: architecture-flow-viewer, Property 1: Diagram shows exactly the nodes of the selected flow
fc.assert(fc.property(fc.constantFrom(...flows), (flow) => {
  const { getByTestId } = render(<FlowDiagram flow={flow} nodes={nodes} ... />);
  const expectedNodeIds = new Set(flow.steps.flatMap(s => [s.from, s.to]));
  const renderedNodeIds = getAllRenderedNodeIds(getByTestId("diagram-canvas"));
  return setsEqual(renderedNodeIds, expectedNodeIds);
}), { numRuns: 100 });
```

**Property 2: Detail panel shows steps in order**

```typescript
// Feature: architecture-flow-viewer, Property 2: Detail panel shows steps in order for the selected flow
fc.assert(fc.property(fc.constantFrom(...flows), (flow) => {
  const { getAllByTestId } = render(<FlowDetail flow={flow} version="1.0" />);
  const stepElements = getAllByTestId("flow-step");
  return flow.steps.every((step, i) =>
    stepElements[i].textContent?.includes(step.action)
  );
}), { numRuns: 100 });
```

**Property 3: Category collapse hides all flows in that category**

```typescript
// Feature: architecture-flow-viewer, Property 3: Category collapse hides all flows in that category
fc.assert(fc.property(fc.constantFrom(...categories), (category) => {
  const { queryAllByTestId, getByLabelText } = render(<FlowSidebar ... />);
  fireEvent.click(getByLabelText(`Collapse ${category} category`));
  const visibleFlows = queryAllByTestId(`flow-item-${category}`);
  return visibleFlows.length === 0;
}), { numRuns: 100 });
```

**Property 4: Pan offset changes by drag delta**

```typescript
// Feature: architecture-flow-viewer, Property 4: Pan offset changes by drag delta
fc.assert(fc.property(
  fc.record({ x: fc.integer(), y: fc.integer() }),
  fc.record({ dx: fc.integer({ min: -500, max: 500 }), dy: fc.integer({ min: -500, max: 500 }) }),
  (initialPan, delta) => {
    // Test the pan reducer function directly (pure function)
    const newPan = applyPanDelta(initialPan, delta.dx, delta.dy);
    return newPan.x === initialPan.x + delta.dx && newPan.y === initialPan.y + delta.dy;
  }
), { numRuns: 100 });
```

**Property 5: Reset view restores default pan and zoom**

```typescript
// Feature: architecture-flow-viewer, Property 5: Reset view restores default pan and zoom
fc.assert(fc.property(
  fc.record({ x: fc.integer(), y: fc.integer() }),
  fc.float({ min: 0.25, max: 3.0 }),
  (pan, zoom) => {
    const { pan: newPan, zoom: newZoom } = applyResetView(pan, zoom);
    return newPan.x === 0 && newPan.y === 0 && newZoom === 1.0;
  }
), { numRuns: 100 });
```

**Property 6: Version badge displays "v" + version string**

```typescript
// Feature: architecture-flow-viewer, Property 6: Version badge displays "v" + version string
fc.assert(fc.property(
  fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  (version) => {
    const { getByTestId } = render(<FlowDetail flow={null} version={version} />);
    return getByTestId("version-badge").textContent === `v${version}`;
  }
), { numRuns: 100 });
```

**Property 7: Keyboard activation selects the flow**

```typescript
// Feature: architecture-flow-viewer, Property 7: Keyboard activation selects the flow
fc.assert(fc.property(fc.constantFrom(...flows), (flow) => {
  const onSelectFlow = jest.fn();
  const { getByLabelText } = render(<FlowSidebar ... onSelectFlow={onSelectFlow} />);
  const button = getByLabelText(`Select ${flow.label} flow`);
  fireEvent.keyDown(button, { key: "Enter" });
  return onSelectFlow.mock.calls.some(([f]) => f.id === flow.id);
}), { numRuns: 100 });
```

**Property 8: Every interactive control has a non-empty aria-label**

```typescript
// Feature: architecture-flow-viewer, Property 8: Every interactive control has a non-empty aria-label
fc.assert(fc.property(fc.constantFrom(...flows), (selectedFlow) => {
  const { container } = render(<FlowViewer data={data} />);
  // Simulate selecting the flow to render all controls
  const buttons = container.querySelectorAll("button");
  return Array.from(buttons).every(btn =>
    btn.getAttribute("aria-label") && btn.getAttribute("aria-label")!.trim().length > 0
  );
}), { numRuns: 100 });
```

**Property 9: aria-live region reflects selected flow label**

```typescript
// Feature: architecture-flow-viewer, Property 9: aria-live region reflects selected flow label
fc.assert(fc.property(fc.constantFrom(...flows), (flow) => {
  const { getByRole } = render(<FlowViewer data={data} />);
  // Select the flow
  fireEvent.click(getByLabelText(`Select ${flow.label} flow`));
  const liveRegion = getByRole("status"); // or query by aria-live
  return liveRegion.textContent === `Selected flow: ${flow.label}`;
}), { numRuns: 100 });
```

### Integration Tests

- **Build validation:** A Node.js script (run as part of CI) calls `loadArchitectureData()` against the real `docs/architecture-flows.json` and asserts it returns without throwing. This verifies the real data file is always valid.
- **Route existence:** A smoke test verifies the `/architecture` route returns HTTP 200 in the built app.

