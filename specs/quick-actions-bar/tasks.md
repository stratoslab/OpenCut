# Tasks: Quick Actions Bar

## Tasks

- [x] **Task 1: Create QuickActionsBar component**
  - **What:** Floating bar with 5 action buttons, appears after transcription, dismissible
  - **Files:** Create `apps/web-vite/src/subtitles/components/QuickActionsBar.tsx`
  - **Done when:** Bar appears post-transcription, buttons clickable, dismissible
  - **Depends on:** none

- [x] **Task 2: Wire actions to existing services**
  - **What:** Connect each button to its service: Smart Cut → smart-cut-executor, Add Subtitles → insertCaptionChunks, Popover → style editor with animation
  - **Files:** Update `apps/web-vite/src/subtitles/components/QuickActionsBar.tsx`
  - **Done when:** Each button executes its action correctly with confirmation dialogs where needed
  - **Depends on:** Task 1, Smart Cut spec, Subtitle Style Editor spec

- [ ] **Task 3: Write tests**
  - **What:** Verify bar appears/disappears correctly, actions execute, confirmation dialogs work
  - **Files:** Create `apps/web-vite/src/subtitles/__tests__/quick-actions-bar.test.tsx`
  - **Done when:** All tests pass
  - **Depends on:** Tasks 1-2
