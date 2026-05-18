# Tasks: Subtitle Style Editor

## Tasks

- [ ] **Task 1: Define SubtitleStyle type and presets**
  - **What:** TypeScript interface for all style properties + 4 preset definitions (CapCut, Classic, Modern, Karaoke)
  - **Files:** Create `apps/web-vite/src/subtitles/style-types.ts`, `apps/web-vite/src/subtitles/style-presets.ts`
  - **Done when:** Style type covers all properties, 4 presets defined with distinct visual configurations
  - **Depends on:** none

- [ ] **Task 2: Build StyleEditorPanel UI**
  - **What:** Panel with preset gallery (clickable cards), custom controls (font selector, color pickers, sliders for size/opacity/outline/position), animation selector
  - **Files:** Create `apps/web-vite/src/subtitles/components/StyleEditorPanel.tsx`
  - **Done when:** User can select presets, adjust all style properties, see changes reflected
  - **Depends on:** Task 1

- [ ] **Task 3: Implement AnimationRenderer**
  - **What:** Canvas-based animation functions for fade, slide, typewriter, bounce, karaoke. Each takes text + style + progress, returns draw instructions.
  - **Files:** Create `apps/web-vite/src/subtitles/animation-renderer.ts`
  - **Done when:** All 5 animations render correctly at various progress values, karaoke highlights words sequentially
  - **Depends on:** Task 1

- [ ] **Task 4: Integrate with subtitle rendering**
  - **What:** Apply SubtitleStyle to existing subtitle rendering pipeline. Update preview and export to use styled subtitles.
  - **Files:** Modify `apps/web-vite/src/subtitles/insert.ts`, `apps/web-vite/src/services/renderer/nodes/text-node.ts`
  - **Done when:** Subtitles render with custom styles in preview and export
  - **Depends on:** Tasks 2-3

- [ ] **Task 5: Write property-based tests**
  - **What:** PBTs for preset application (all properties set), position clamping (within canvas), animation timing (synchronized with timestamps)
  - **Files:** Create `apps/web-vite/src/subtitles/__tests__/style-presets.test.ts`, `animation-renderer.test.ts`
  - **Done when:** All tests pass with 200+ cases
  - **Depends on:** Tasks 1-4
