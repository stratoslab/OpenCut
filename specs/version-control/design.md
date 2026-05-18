# Design: Version Control

## Overview

A commit-based version control system stored in IndexedDB. Each commit captures a serialized snapshot of the project state plus a rendered thumbnail. Branches are named pointers to commits. The UI provides a history view, diff comparison, and restore functionality.

## Components

### Component 1: CommitStore
- **Responsibility:** Create, store, retrieve commits in IndexedDB
- **Interface:** `create(message, state)`, `get(id)`, `getAll(branch)`, `restore(id)`
- **Key design:** Each commit stores serialized project state + thumbnail data URL + metadata

### Component 2: BranchManager
- **Responsibility:** Create, switch, delete branches
- **Interface:** `create(name, fromCommit)`, `switch(name)`, `list(): Branch[]`

### Component 3: DiffEngine
- **Responsibility:** Compare two commit states, generate human-readable diff
- **Interface:** `diff(commitA, commitB): DiffResult`
- **Key design:** Compares timeline tracks, elements, effects, transitions

### Component 4: VersionControlBar + Drawer
- **Responsibility:** UI showing current branch, dirty indicator, commit history, diff view
- **Interface:** React components in editor header

## Data Model

```typescript
interface Commit {
  id: string;
  message: string;
  timestamp: Date;
  branch: string;
  thumbnail: string;  // data URL
  state: SerializedProjectState;
  parent?: string;
}

interface Branch {
  name: string;
  headCommitId: string;
  isMain: boolean;
}
```

## Data Flow

1. User clicks "Commit" → current project state serialized → commit stored in IndexedDB
2. User clicks "Branch" → new branch created from current HEAD
3. User switches branches → project state restored from that branch's HEAD commit
4. User views history → commits listed with thumbnail diff comparison

## Error Handling

| Situation | Handling |
|-----------|----------|
| IndexedDB quota exceeded during commit | Show storage warning — suggest deleting old branches |
| Commit size exceeds IndexedDB single-record limit (est. 32MB) | Store thumbnail separately, compress state |
| User tries to delete "main" branch | Disable delete — main cannot be removed |
| Restore fails mid-way | Leave current project state unchanged, log error |
| Branch switch with uncommitted changes | Prompt to commit or discard before switching |

## Testing Strategy

- **Unit test:** CommitStore.create() and .get() round-trip correctly
- **Unit test:** BranchManager prevents deleting main branch
- **Unit test:** DiffEngine produces correct diff between two known states
- **Property-based test:** For any project state, serialization round-trip through CommitStore SHALL produce an identical state after restore
