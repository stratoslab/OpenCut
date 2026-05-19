# Requirements Document

## Introduction

This feature makes the existing OpenCut architecture flow diagram accessible directly from the web app at a dedicated `/architecture` route. The interactive viewer — currently a standalone HTML file at `docs/architecture-flows.html` — will be served as a Next.js page within `apps/web`, and a link to it will be added to the homepage so developers and contributors can use it as a starting guide to understand the codebase.

The viewer displays a three-panel layout: a sidebar listing workflow categories (editing, AI, assets, deployment), a central diagram area with nodes and connections, and a detail panel showing step-by-step flow descriptions. The underlying data lives in `docs/architecture-flows.json`.

## Glossary

- **Architecture_Page**: The Next.js page served at `/architecture` within `apps/web`.
- **Flow_Viewer**: The interactive three-panel UI component that renders the architecture diagram, sidebar, and detail panel.
- **Architecture_Data**: The JSON dataset from `docs/architecture-flows.json` describing nodes, flows, and categories.
- **Sidebar**: The left panel listing workflow categories and individual flows for selection.
- **Diagram_Area**: The central panel rendering nodes and directional connections for the selected flow.
- **Detail_Panel**: The right panel showing step-by-step descriptions for the selected flow.
- **Header**: The existing `apps/web` site header component used across all public pages.
- **Footer**: The existing `apps/web` site footer component used across all public pages.
- **Homepage**: The page served at `/` in `apps/web`.
- **BasePage**: The existing layout wrapper component (`src/app/base-page.tsx`) that composes Header and Footer.

## Requirements

### Requirement 1: Dedicated Architecture Route

**User Story:** As a developer or contributor, I want to visit `/architecture` in the web app, so that I can explore the interactive architecture flow diagram without leaving the project site.

#### Acceptance Criteria

1. THE Architecture_Page SHALL be served at the `/architecture` route within `apps/web`.
2. THE Architecture_Page SHALL render the Header and Footer using the existing BasePage layout wrapper.
3. THE Architecture_Page SHALL include a `<title>` of "Architecture - OpenCut" and a meta description of no more than 155 characters summarising the interactive flow diagram.
4. WHEN a user navigates to `/architecture`, THE Architecture_Page SHALL display the Flow_Viewer as a client-side-only component (rendered with `dynamic(..., { ssr: false })` or equivalent) so that browser-only APIs are not invoked during static generation.
5. THE Architecture_Page SHALL be statically renderable at build time: the page module SHALL export no `getServerSideProps`, no `getInitialProps`, and SHALL NOT import any module that performs a network request at module evaluation time.

---

### Requirement 2: Flow Viewer Component

**User Story:** As a developer, I want to interact with the architecture diagram on the `/architecture` page, so that I can understand how the different parts of the codebase connect.

#### Acceptance Criteria

1. THE Flow_Viewer SHALL render a Sidebar, a Diagram_Area, and a Detail_Panel in a three-column layout on desktop viewports (≥ 900 px wide).
2. THE Flow_Viewer SHALL load Architecture_Data from `docs/architecture-flows.json` at build time via `getStaticProps` (or equivalent static import) and pass it as props — no `fetch()` or XHR call SHALL be made at runtime.
3. WHEN a user selects a flow from the Sidebar, THE Flow_Viewer SHALL update the Diagram_Area within one animation frame to display only the nodes and directional connections belonging to that flow, highlighting active nodes and dimming inactive ones.
4. WHEN a user selects a flow from the Sidebar, THE Flow_Viewer SHALL update the Detail_Panel within one animation frame to display the ordered list of step descriptions for that flow.
5. WHEN no flow is selected, THE Flow_Viewer SHALL display an empty-state placeholder in both the Diagram_Area and the Detail_Panel containing the text "Select a workflow from the sidebar".
6. THE Sidebar SHALL group flows by category; each category group SHALL be independently collapsible and expandable by clicking the category header.
7. THE Diagram_Area SHALL support mouse-drag pan and scroll-wheel zoom interactions.
8. THE Diagram_Area SHALL render a Reset View button, a zoom-in button (+), and a zoom-out button (−) as persistent on-screen controls; activating Reset View SHALL restore the diagram to its default pan and zoom state.
9. WHILE a viewport width is less than 900 px, THE Flow_Viewer SHALL hide the Sidebar and Detail_Panel and display only the Diagram_Area at full width.

---

### Requirement 3: Architecture Data Integrity

**User Story:** As a developer, I want the viewer to always reflect the current architecture data, so that the diagram stays accurate as the codebase evolves.

#### Acceptance Criteria

1. THE Architecture_Page SHALL read Architecture_Data exclusively from `docs/architecture-flows.json` — no copy of the data SHALL exist inside any component file or be inlined as a JavaScript literal.
2. IF `docs/architecture-flows.json` is absent at build time, THEN the Next.js build SHALL exit with a non-zero status code and SHALL log an error message containing the string "architecture-flows.json not found".
3. IF `docs/architecture-flows.json` contains invalid JSON at build time, THEN the Next.js build SHALL exit with a non-zero status code and SHALL log an error message containing the string "architecture-flows.json is invalid JSON".
4. THE Flow_Viewer SHALL display the `version` field from Architecture_Data as a badge element in the viewer header; the badge text SHALL be the string "v" concatenated with the version value (e.g., "v11.0").

---

### Requirement 4: Homepage Link

**User Story:** As a developer visiting the OpenCut homepage, I want a visible link to the architecture viewer, so that I can quickly find the codebase guide without searching.

#### Acceptance Criteria

1. THE Header navigation SHALL render an "Architecture" link pointing to `/architecture` in the same link list as the existing Roadmap, Contributors, Sponsors, and Blog links, visible in the desktop nav bar without any user interaction.
2. THE Header navigation SHALL include the "Architecture" link in the mobile menu so that it is reachable on viewports narrower than 768 px.
3. THE Footer SHALL render an "Architecture" link pointing to `/architecture` under the "Resources" section alongside the existing footer links.
4. WHEN a user clicks any "Architecture" link in the Header or Footer, THE browser SHALL navigate to `/architecture` and THE Architecture_Page SHALL render the Flow_Viewer.

---

### Requirement 5: Accessibility

**User Story:** As a developer using keyboard navigation or a screen reader, I want the architecture viewer to be navigable, so that the tool is accessible to all contributors.

#### Acceptance Criteria

1. THE Sidebar flow items SHALL be rendered as `<button>` elements (or elements with `role="button"`); WHEN a flow item has keyboard focus and the user presses Enter or Space, THE Flow_Viewer SHALL select that flow and update the Diagram_Area and Detail_Panel.
2. THE Diagram_Area zoom-in, zoom-out, and Reset View controls SHALL be reachable via sequential Tab navigation; WHEN any of these controls has keyboard focus and the user presses Enter or Space, THE control SHALL execute its action.
3. WHEN any interactive control in the Flow_Viewer has keyboard focus, THE control SHALL display a visible focus indicator (outline or equivalent) that meets WCAG 2.1 SC 2.4.7 (minimum 2 px contrast-visible outline).
4. THE Flow_Viewer SHALL provide an `aria-label` attribute on every interactive control; each label SHALL uniquely identify the control's action (e.g., "Zoom in", "Zoom out", "Reset view", "Expand editing category", "Select Import Media flow").
5. WHEN a flow is selected, THE Flow_Viewer SHALL update an `aria-live="polite"` region with the text "Selected flow: {flow label}" so that screen readers announce the selection.
