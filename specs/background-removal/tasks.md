# Tasks: Background Removal

## Tasks

- [ ] **Task 1: Create BackgroundRemovalDialog**
  - **What:** Dialog with image upload/timeline selection, "Remove Background" button, progress indicator, result preview
  - **Files:** Create `apps/web-vite/src/background-removal/components/BackgroundRemovalDialog.tsx`
  - **Done when:** User can select image, process it, see result
  - **Depends on:** none

- [ ] **Task 2: Build BeforeAfterSlider**
  - **What:** Interactive comparison component with draggable divider showing original vs processed image
  - **Files:** Create `apps/web-vite/src/background-removal/components/BeforeAfterSlider.tsx`
  - **Done when:** Slider works smoothly, shows both images correctly
  - **Depends on:** none

- [ ] **Task 3: Integrate with timeline**
  - **What:** Add processed image to timeline as transparent element at playhead position
  - **Files:** Create `apps/web-vite/src/background-removal/timeline-integration.ts`
  - **Done when:** Processed image appears in preview with transparency preserved
  - **Depends on:** Tasks 1-2

- [ ] **Task 4: Write tests**
  - **What:** Verify image processing preserves dimensions, output has alpha channel, timeline integration works
  - **Files:** Create `apps/web-vite/src/background-removal/__tests__/background-removal.test.ts`
  - **Done when:** All tests pass
  - **Depends on:** Tasks 1-3
