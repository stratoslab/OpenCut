---
description: Plan-first spec workflow. Creates requirements, design, and task documents before any code is written. Supports new features (requirements-first or design-first) and bug fixes. Usage: /spec-workflow [brief description of what you want to build or fix]
---

# Spec Workflow

You are running a structured plan-first development workflow. Your job is to guide the user through creating three documents — requirements, design, and tasks — before any implementation begins. Each document must be approved by the user before moving to the next.

The user's request is: `$ARGUMENTS`

---

## STEP 0 — Understand the Project Context

Before asking anything, silently scan the workspace to understand what you're working with:

- Read `package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, or equivalent to identify the tech stack
- Skim the top-level directory structure
- Check for any existing `.kiro/specs/` or `specs/` directories to avoid naming conflicts

Do not output anything from this step. Use it to inform your questions and document generation.

---

## STEP 1 — Determine Spec Type

Ask the user exactly one question to classify the work. Present it as a clear choice:

> **Is this a new feature or a bug fix?**
>
> - **Feature** — adding new functionality that doesn't exist yet
> - **Bug Fix** — fixing something that is broken, crashing, or behaving incorrectly

If `$ARGUMENTS` contains strong signals, make a recommendation:
- Words like "fix", "bug", "crash", "error", "broken", "not working", "wrong", "regression" → recommend Bug Fix
- Words like "add", "new", "create", "implement", "build", "introduce" → recommend Feature
- If unclear, present both options without a recommendation

Wait for the user's response before continuing.

---

## STEP 2 — Choose Starting Point (Feature only)

If the user chose **Bug Fix**, skip to Step 3.

If the user chose **Feature**, ask:

> **Where do you want to start?**
>
> - **Requirements first** — define what needs to be built, then derive the technical design from that
> - **Design first** — you already know the technical approach; formalize requirements from the design
> - **Quick plan** — auto-generate all three documents with minimal back-and-forth (fastest path)

Wait for the user's response before continuing.

---

## STEP 3 — Derive the Feature Name

From `$ARGUMENTS` and the user's responses so far, derive a short kebab-case feature name.

Examples:
- "add user authentication" → `user-authentication`
- "fix crash when quantity is zero" → `quantity-zero-crash`
- "implement payment processing" → `payment-processing`

The feature name will be used as the directory name for all spec files. Do not ask the user for this — derive it yourself. If `$ARGUMENTS` is empty, use a name based on what the user described in Step 1.

All spec files go in: `specs/{feature-name}/`

---

## STEP 4 — Generate the First Document

### If Bug Fix → Generate `specs/{feature-name}/requirements.md`

Write a requirements document focused on the bug condition methodology:

```markdown
# Requirements: {Feature Name}

## Introduction

[1–2 sentence description of the bug and its impact]

## Bug Condition

**Trigger:** [Precise description of what causes the bug — inputs, state, sequence of events]
**Observed behavior:** [What actually happens]
**Expected behavior:** [What should happen instead]
**Affected components:** [Files, modules, or systems involved]

## Glossary

[Define any domain-specific terms used in this document]

## Requirements

### Requirement 1: [Title]

**User Story:** As a [role], I want [correct behavior], so that [benefit / harm avoided]

#### Acceptance Criteria

1. WHEN [trigger condition] THEN the system SHALL [correct behavior]
2. WHEN [edge case] THEN the system SHALL [handle it correctly]
3. IF [error state] THEN the system SHALL [fail gracefully]

#### Correctness Properties

- **Property 1:** [Invariant that must always hold — e.g., "quantity SHALL never be negative"]
- **Property 2:** [Another invariant]

[Add more requirements if the fix touches multiple behaviors]
```

### If Feature + Requirements First → Generate `specs/{feature-name}/requirements.md`

Write a requirements document covering all user-facing behaviors:

```markdown
# Requirements: {Feature Name}

## Introduction

[2–3 sentence description of the feature, its purpose, and who it serves]

## Glossary

[Define domain-specific terms used in this document]

## Requirements

### Requirement 1: [Title]

**User Story:** As a [role], I want [feature], so that [benefit]

#### Acceptance Criteria

Use EARS format (WHERE, WHILE, WHEN, IF, THEN, THE, SHALL):

1. WHEN [event] THEN the system SHALL [response]
2. IF [condition] THEN the system SHALL [behavior]
3. WHILE [state] THE system SHALL [maintain behavior]
4. WHERE [context] THE system SHALL [apply rule]

#### Correctness Properties

- **Property 1:** [Formal invariant the implementation must uphold]
- **Property 2:** [Another invariant — think about what can never be violated]

[Repeat for each distinct requirement]
```

### If Feature + Design First → Generate `specs/{feature-name}/design.md`

Write a technical design document first (requirements come after):

```markdown
# Design: {Feature Name}

## Overview

[2–3 sentence summary of the technical approach]

## Architecture

[Describe the high-level component structure. Use ASCII diagrams if helpful.]

## Components

### Component 1: [Name]
- **Responsibility:** [What it does]
- **Interface:** [Key inputs/outputs or API surface]
- **Dependencies:** [What it depends on]

[Repeat for each component]

## Data Models

[Define key data structures, schemas, or types]

## Data Flow

[Describe how data moves through the system — request/response, events, state changes]

## Key Algorithms

[Describe any non-trivial logic, state machines, or processing steps]

## Error Handling

[How errors are caught, surfaced, and recovered from]

## Testing Strategy

[How correctness properties will be verified — unit tests, property-based tests, integration tests]
```

### If Quick Plan → Generate all three documents automatically

Generate `requirements.md`, then `design.md`, then `tasks.md` in sequence without pausing for approval between them. After all three are written, present a summary and ask if the user wants to adjust anything before implementation begins.

---

## STEP 5 — Wait for Approval

After generating the first document, present it to the user and ask:

> **Does this look right? Any changes before I move to the [next document]?**

List specific things they might want to adjust:
- For requirements: scope, missing requirements, incorrect acceptance criteria, wrong user roles
- For design: architecture approach, missing components, technology choices, data model

**Do not proceed until the user explicitly approves.** Accept "looks good", "yes", "proceed", "continue", or similar as approval. If they request changes, update the document and ask again.

---

## STEP 6 — Generate the Second Document

### Requirements First path:
After `requirements.md` is approved → generate `specs/{feature-name}/design.md`

The design must directly address every requirement in `requirements.md`. For each requirement, there should be a clear component or mechanism in the design that satisfies it.

```markdown
# Design: {Feature Name}

## Overview

[How the system will be built to satisfy the requirements]

## Architecture

[Component diagram or description]

## Components

[One section per major component — name, responsibility, interface, dependencies]

## Data Models

[Schemas, types, or data structures]

## Data Flow

[How data moves through the system]

## Key Algorithms

[Non-trivial logic]

## Requirements Traceability

| Requirement | Satisfied By |
|-------------|-------------|
| Req 1: [Title] | [Component or mechanism] |
| Req 2: [Title] | [Component or mechanism] |

## Testing Strategy

[How each correctness property will be verified with property-based tests]
```

### Design First path:
After `design.md` is approved → generate `specs/{feature-name}/requirements.md`

Derive requirements from the design. Each component or behavior in the design should map to at least one requirement.

### Bug Fix path:
After `requirements.md` is approved → generate `specs/{feature-name}/design.md`

The design must explain exactly how the bug condition will be eliminated and what code changes are needed.

---

## STEP 7 — Wait for Approval Again

Present the second document and ask:

> **Does this design look right? Any changes before I generate the task list?**

Do not proceed until approved.

---

## STEP 8 — Generate `specs/{feature-name}/tasks.md`

Generate a concrete, ordered implementation task list. Each task must be:
- Small enough to complete in one focused session
- Independently executable (no hidden dependencies within a task)
- Unambiguous about what "done" means

```markdown
# Tasks: {Feature Name}

## Overview

[1–2 sentence summary of the implementation plan]

## Task Dependency Graph

```
Task 1 → Task 2 → Task 4
              ↘ Task 3 → Task 5
```

## Tasks

- [ ] **Task 1: [Title]**
  - **What:** [Concrete description of what to implement]
  - **Files:** [Which files to create or modify]
  - **Done when:** [Specific, verifiable completion criteria]
  - **Depends on:** none

- [ ] **Task 2: [Title]**
  - **What:** [Description]
  - **Files:** [Files]
  - **Done when:** [Criteria]
  - **Depends on:** Task 1

[Continue for all tasks]

## Property-Based Tests

For each correctness property defined in requirements.md, include a task to write a property-based test:

- [ ] **Task N: Write property-based tests for [Property Name]**
  - **What:** Implement a PBT that generates random inputs and verifies [invariant]
  - **Files:** `tests/` or equivalent test directory
  - **Done when:** Test runs, generates 100+ cases, and all pass
  - **Depends on:** [Implementation task it tests]
```

---

## STEP 9 — Final Approval

Present the task list and ask:

> **The spec is complete. Does the task list look right before we start building?**

If approved, output:

---

**Spec ready.** All three documents are in `specs/{feature-name}/`.

To start implementation:
- Run tasks one at a time, in order
- Each task references the design and requirements for context
- Mark tasks complete as you go

The correctness properties in `requirements.md` define what "working correctly" means. The property-based tests in the task list will verify the implementation against those properties.

---

## RULES

- **Never write code** during the spec workflow. This phase is planning only.
- **Never skip approval gates.** Each document must be explicitly approved before the next is generated.
- **Never assume scope.** If the user's request is ambiguous, ask a clarifying question rather than guessing.
- **Keep documents consistent.** Every requirement must be addressed in the design. Every design decision must trace back to a requirement. Every task must implement something from the design.
- **EARS format for acceptance criteria.** Use WHERE, WHILE, WHEN, IF, THEN, THE, SHALL keywords. Avoid vague language like "should", "might", or "could".
- **Correctness properties are mandatory.** Every requirements document must include at least one formal invariant per requirement. These become the basis for property-based tests.
- **Quick Plan exception.** In Quick Plan mode, skip approval gates between documents but always ask for final approval before declaring the spec complete.
