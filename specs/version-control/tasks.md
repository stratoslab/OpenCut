# Tasks: Version Control

## Tasks

- [ ] **Task 1: Create CommitStore**
  - **What:** IndexedDB-backed commit storage with create, get, getAll, restore operations. Serializes project state + thumbnail.
  - **Files:** Create `apps/web-vite/src/version-control/commit-store.ts`
  - **Done when:** Commits can be created, retrieved, and restored. State is fully serializable and restorable.
  - **Depends on:** none

- [ ] **Task 2: Create BranchManager**
  - **What:** Branch management: create, switch, list, delete. Main branch always exists.
  - **Files:** Create `apps/web-vite/src/version-control/branch-manager.ts`
  - **Done when:** Branches can be created from any commit, switching loads correct state, main branch protected
  - **Depends on:** Task 1

- [ ] **Task 3: Create DiffEngine**
  - **What:** Compare two commit states, generate diff of timeline changes (added/removed clips, modified effects, etc.)
  - **Files:** Create `apps/web-vite/src/version-control/diff-engine.ts`
  - **Done when:** Diff accurately reflects all changes between commits, comparing same commit shows no differences
  - **Depends on:** Task 1

- [ ] **Task 4: Build VersionControlBar**
  - **What:** Header bar showing current branch, dirty indicator (yellow dot), quick commit button, history button
  - **Files:** Create `apps/web-vite/src/version-control/components/VersionControlBar.tsx`
  - **Done when:** Bar displays branch name, dirty state, commit button works
  - **Depends on:** Tasks 1-2

- [ ] **Task 5: Build VersionControlDrawer**
  - **What:** Side sheet with History tab (commit list with thumbnails) and Changes tab (diff view). Restore button per commit.
  - **Files:** Create `apps/web-vite/src/version-control/components/VersionControlDrawer.tsx`
  - **Done when:** User can browse commits, view diffs, restore to any commit
  - **Depends on:** Tasks 1-4

- [ ] **Task 6: Auto-commit messages**
  - **What:** Generate descriptive commit messages based on what changed (e.g., "Split clip at 2:30", "Added crossfade transition")
  - **Files:** Create `apps/web-vite/src/version-control/auto-message.ts`
  - **Done when:** Empty commit messages are auto-generated based on recent commands
  - **Depends on:** Task 1

- [ ] **Task 7: Write tests**
  - **What:** PBTs for commit immutability, restore correctness, branch switching, diff accuracy
  - **Files:** Create `apps/web-vite/src/version-control/__tests__/commit-store.test.ts`, `diff-engine.test.ts`
  - **Done when:** All tests pass with 200+ cases
  - **Depends on:** Tasks 1-6
