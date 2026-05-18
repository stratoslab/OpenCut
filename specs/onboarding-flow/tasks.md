# Tasks: Onboarding Flow

## Tasks

- [ ] **Task 1: Create OnboardingDialog component**
  - **What:** 3-step modal dialog with navigation (Next/Back/Skip/Get Started), localStorage integration for first-run detection
  - **Files:** Create `apps/web-vite/src/onboarding/components/OnboardingDialog.tsx`
  - **Done when:** Dialog auto-shows on first visit, 3 steps navigable, completion recorded in localStorage
  - **Depends on:** none

- [ ] **Task 2: Create step content**
  - **What:** Step 1 (Welcome + workflow overview), Step 2 (AI model status with load buttons), Step 3 (Ready to start)
  - **Files:** Create `apps/web-vite/src/onboarding/steps.tsx`
  - **Done when:** All 3 steps display correctly with proper content and AI model status integration
  - **Depends on:** Task 1

- [ ] **Task 3: Integrate with App**
  - **What:** Add OnboardingDialog to App.tsx, check localStorage on mount, auto-show if first visit
  - **Files:** Update `apps/web-vite/src/App.tsx`
  - **Done when:** Onboarding shows on first visit, doesn't show on subsequent visits
  - **Depends on:** Tasks 1-2

- [ ] **Task 4: Write tests**
  - **What:** Verify first-run detection, step navigation, localStorage persistence, AI model status display
  - **Files:** Create `apps/web-vite/src/onboarding/__tests__/onboarding.test.tsx`
  - **Done when:** All tests pass
  - **Depends on:** Tasks 1-3
