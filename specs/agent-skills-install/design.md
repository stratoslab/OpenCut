# Design: Agent Skills Install

## Overview

Install 5 skills from addyosmani/agent-skills into OpenCode's skill discovery system (`.opencode/skills/`), update AGENTS.md with skill triggers, and adapt any tool-specific references to work with OpenCode's `skill` tool interface.

## Architecture

```
OpenCut/
├── .opencode/
│   └── skills/                          # New directory
│       ├── context-engineering/
│       │   └── SKILL.md
│       ├── debugging-and-error-recovery/
│       │   └── SKILL.md
│       ├── performance-optimization/
│       │   └── SKILL.md
│       ├── doubt-driven-development/
│       │   └── SKILL.md
│       └── code-simplification/
│           └── SKILL.md
├── AGENTS.md                            # Updated with skill discovery section
└── specs/
    └── agent-skills-install/            # This spec
        ├── requirements.md
        ├── design.md
        └── tasks.md
```

## Components

### Component 1: Skill Installer (Script)
- **Responsibility:** Fetch SKILL.md files from addyosmani/agent-skills and place them in `.opencode/skills/{name}/`
- **Interface:** Bash script that clones the repo, copies skill directories, and adapts tool references
- **Dependencies:** git, bash

### Component 2: AGENTS.md Updater
- **Responsibility:** Add a "Skills" section to AGENTS.md listing all installed skills with trigger conditions
- **Interface:** Manual edit following the existing AGENTS.md format
- **Dependencies:** None

### Component 3: Tool Reference Adapter
- **Responsibility:** Replace tool-specific references (Claude Code subagents, Cursor rules, etc.) with OpenCode-compatible patterns
- **Interface:** Applied during the copy step of the installer
- **Dependencies:** Understanding of OpenCode's `skill` tool

## Data Models

No new data models. Skills are plain markdown files.

## Data Flow

```
1. Fetch SKILL.md from GitHub repo
2. Adapt tool-specific references → OpenCode patterns
3. Place in .opencode/skills/{name}/SKILL.md
4. Update AGENTS.md with skill triggers
5. Agent discovers skills on next session start
```

## Key Algorithms

### Tool Reference Adaptation Rules

| Original Reference | OpenCode Adaptation |
|-------------------|---------------------|
| "In Claude Code, spawn a subagent" | "Use the Task tool with a fresh prompt" |
| "Add to CLAUDE.md" | "Update AGENTS.md" |
| "Use Context7 MCP" | "Use the webfetch/websearch tools" |
| "Chrome DevTools MCP" | "Use the browse tool" |
| "Add to .cursor/rules/" | "Add to .opencode/skills/" |

## Error Handling

- If a skill fetch fails (network error), report which skill failed and retry
- If AGENTS.md already has a "Skills" section, merge rather than duplicate
- If a skill name conflicts with an existing skill, append `-external` suffix

## Requirements Traceability

| Requirement | Satisfied By |
|-------------|-------------|
| Req 1: Install Skills | Component 1 (Skill Installer) — copies SKILL.md files to `.opencode/skills/` |
| Req 2: Update AGENTS.md | Component 2 (AGENTS.md Updater) — adds skill discovery section |
| Req 3: Integrate with Spec Workflow | Component 2 — documents skill triggers that align with spec phases |
| Req 4: Performance Optimization | Component 1 + 3 — installs and adapts the performance-optimization skill |
| Req 5: Model-Agnostic | Component 3 (Tool Reference Adapter) — removes platform-specific references |

## Testing Strategy

- Verify all 5 SKILL.md files exist in `.opencode/skills/`
- Verify each has valid frontmatter (`name` and `description` fields)
- Verify AGENTS.md contains references to all 5 skills
- Verify no skill contains hardcoded references to "Claude Code", "Cursor", or other platforms
- Verify skill descriptions are under 50 words for fast agent parsing
