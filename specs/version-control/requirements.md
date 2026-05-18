# Requirements: Version Control

## Introduction

Git-like version control for video projects: commits with thumbnails, branches, tags, diff view, and restore to any commit. Enables users to save milestones, experiment with branches, and revert changes without losing work.

## Glossary

- **Commit**: A snapshot of the project state with a message, timestamp, and rendered thumbnail
- **Branch**: A named pointer to a commit, allowing parallel editing paths
- **Tag**: A named label attached to a specific commit (e.g., "v1.0", "final-cut")
- **Diff**: A visual comparison between two commits showing what changed
- **Restore**: Reverting the project state to a previous commit

## Requirements

### Requirement 1: Commits

**User Story:** As a user, I want to save snapshots of my project with messages, so that I can return to any point in my editing history

#### Acceptance Criteria

1. WHEN the user creates a commit THEN the system SHALL save the full project state with a message and timestamp
2. WHEN a commit is created THEN the system SHALL render a thumbnail from the current preview
3. IF the user creates a commit with no message THEN the system SHALL auto-generate a descriptive message
4. WHEN commits are listed THEN the system SHALL show them in reverse chronological order with thumbnails

#### Correctness Properties

- **Property 1:** Each commit SHALL be immutable after creation
- **Property 2:** Restoring to a commit SHALL produce the exact same project state as when the commit was created

### Requirement 2: Branches

**User Story:** As a user, I want to create branches to experiment with different edits, so that I can try changes without affecting my main project

#### Acceptance Criteria

1. WHEN the user creates a branch THEN the system SHALL create a new pointer from the current commit
2. WHEN the user switches branches THEN the system SHALL load that branch's project state
3. IF the user has unsaved changes THEN the system SHALL warn before switching branches

#### Correctness Properties

- **Property 1:** Switching branches SHALL not lose commits on the previous branch
- **Property 2:** The main branch SHALL always exist and cannot be deleted

### Requirement 3: Diff View

**User Story:** As a user, I want to see what changed between commits, so that I can understand my editing history

#### Acceptance Criteria

1. WHEN the user compares two commits THEN the system SHALL display a diff of timeline changes
2. IF clips were added/removed THEN the system SHALL show them in the diff
3. WHEN the user views a diff THEN the system SHALL show before/after thumbnails side by side

#### Correctness Properties

- **Property 1:** The diff SHALL accurately reflect all changes between the two commit states
- **Property 2:** Comparing a commit with itself SHALL show no differences

### Requirement 4: Restore

**User Story:** As a user, I want to restore my project to any previous commit, so that I can undo major changes or recover from mistakes

#### Acceptance Criteria

1. WHEN the user restores to a commit THEN the system SHALL replace the current state with that commit's state
2. IF the user restores THEN the system SHALL create a new commit recording the restore action
3. WHEN the user undoes a restore THEN the system SHALL return to the pre-restore state

#### Correctness Properties

- **Property 1:** Restore SHALL not delete any existing commits
- **Property 2:** After restore, the project state SHALL be identical to the restored commit's state
