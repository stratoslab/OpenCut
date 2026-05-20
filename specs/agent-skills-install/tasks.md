# Tasks: Agent Skills Install

## Overview

Install 5 agent skills from addyosmani/agent-skills into OpenCode's skill system, adapt tool references, and update AGENTS.md for skill discovery.

## Task Dependency Graph

```
Task 1 → Task 2 → Task 3 → Task 4 → Task 5
```

## Tasks

- [ ] **Task 1: Install context-engineering skill**
  - **What:** Fetch SKILL.md from addyosmani/agent-skills and place in `.opencode/skills/context-engineering/SKILL.md`, adapting tool references
  - **Files:** `.opencode/skills/context-engineering/SKILL.md`
  - **Done when:** File exists with valid frontmatter and OpenCode-adapted references
  - **Depends on:** none

- [ ] **Task 2: Install debugging-and-error-recovery skill**
  - **What:** Fetch SKILL.md and place in `.opencode/skills/debugging-and-error-recovery/SKILL.md`, adapting tool references
  - **Files:** `.opencode/skills/debugging-and-error-recovery/SKILL.md`
  - **Done when:** File exists with valid frontmatter and OpenCode-adapted references
  - **Depends on:** Task 1

- [ ] **Task 3: Install performance-optimization skill**
  - **What:** Fetch SKILL.md and place in `.opencode/skills/performance-optimization/SKILL.md`, adapting tool references
  - **Files:** `.opencode/skills/performance-optimization/SKILL.md`
  - **Done when:** File exists with valid frontmatter and OpenCode-adapted references
  - **Depends on:** Task 2

- [ ] **Task 4: Install doubt-driven-development skill**
  - **What:** Fetch SKILL.md and place in `.opencode/skills/doubt-driven-development/SKILL.md`, adapting tool references
  - **Files:** `.opencode/skills/doubt-driven-development/SKILL.md`
  - **Done when:** File exists with valid frontmatter and OpenCode-adapted references
  - **Depends on:** Task 3

- [ ] **Task 5: Install code-simplification skill**
  - **What:** Fetch SKILL.md and place in `.opencode/skills/code-simplification/SKILL.md`, adapting tool references
  - **Files:** `.opencode/skills/code-simplification/SKILL.md`
  - **Done when:** File exists with valid frontmatter and OpenCode-adapted references
  - **Depends on:** Task 4

- [ ] **Task 6: Update AGENTS.md with skill discovery section**
  - **What:** Add a "Skills" section to AGENTS.md listing all 5 installed skills with trigger conditions
  - **Files:** `AGENTS.md`
  - **Done when:** AGENTS.md contains skill names, descriptions, and trigger conditions for all 5 skills
  - **Depends on:** Tasks 1-5

- [ ] **Task 7: Verify installation**
  - **What:** Run verification checks: all files exist, valid frontmatter, no platform-specific references, AGENTS.md updated
  - **Files:** None (verification only)
  - **Done when:** All checks pass:
    - 5 SKILL.md files exist in `.opencode/skills/`
    - Each has `name` and `description` in frontmatter
    - No hardcoded "Claude Code", "Cursor", or platform references
    - AGENTS.md lists all 5 skills
  - **Depends on:** Task 6
