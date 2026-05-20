# Requirements: Agent Skills Install

## Introduction

Install 5 production-grade engineering skills from addyosmani/agent-skills into the OpenCut project to improve agent memory, output quality, and development stability. These skills encode structured workflows that senior engineers use — context management, debugging triage, performance optimization, adversarial review, and code simplification.

## Glossary

| Term | Definition |
|------|-----------|
| **Agent Skills** | Structured markdown workflows that guide AI coding agents through engineering best practices |
| **Context Engineering** | Curating what the agent sees, when it sees it, and how it's structured |
| **Doubt-Driven Development** | Adversarial fresh-context review of non-trivial decisions before they stand |
| **Stop-the-Line Rule** | When anything unexpected happens, stop adding features and follow structured triage |
| **OpenCode** | The AI coding agent platform used in this project (opencode.ai) |
| **Skill** | A single SKILL.md file with frontmatter, overview, workflow steps, and verification gates |

## Requirements

### Requirement 1: Install Skills from External Repository

**User Story:** As a developer, I want the agent skills installed locally in my project so that the AI coding agent can follow structured engineering workflows.

#### Acceptance Criteria

1. WHEN a skill is installed THEN it SHALL be placed in `.opencode/skills/{skill-name}/SKILL.md`
2. IF a skill references external files THEN those references SHALL be included alongside the SKILL.md
3. WHEN all 5 skills are installed THEN the OpenCode agent SHALL be able to discover and load them

#### Correctness Properties

- **Property 1:** All installed SKILL.md files SHALL have valid YAML frontmatter with `name` and `description` fields
- **Property 2:** No installed skill SHALL modify or conflict with existing project conventions in AGENTS.md

### Requirement 2: Update AGENTS.md with Skill Discovery

**User Story:** As a developer, I want the agent to know which skills are available and when to use them so that they are actually invoked during development.

#### Acceptance Criteria

1. WHEN the agent starts a session THEN it SHALL be aware of all 5 installed skills
2. WHEN a task matches a skill's trigger conditions THEN the agent SHALL follow that skill's workflow
3. IF multiple skills apply THEN the agent SHALL use the most specific one

#### Correctness Properties

- **Property 1:** The AGENTS.md skills section SHALL list every installed skill with its name and trigger conditions
- **Property 2:** Skill descriptions SHALL be concise (under 50 words each) for fast agent parsing

### Requirement 3: Integrate with Existing Spec Workflow

**User Story:** As a developer, I want the new skills to work alongside the existing `/spec-workflow` command so that planning and implementation are both covered.

#### Acceptance Criteria

1. WHEN using `/spec-workflow` THEN the `context-engineering` skill SHALL inform how project context is loaded
2. WHEN implementing tasks from a spec THEN the `debugging-and-error-recovery` skill SHALL be available if things break
3. WHEN reviewing implementation THEN the `doubt-driven-development` and `code-simplification` skills SHALL be available

#### Correctness Properties

- **Property 1:** Skills SHALL NOT duplicate or conflict with the spec-workflow's planning phase
- **Property 2:** Skills SHALL complement the spec-workflow's implementation phase

### Requirement 4: Add Performance Optimization Skill for Video Editor Workloads

**User Story:** As a developer working on a video editor with WebGPU and WASM, I want performance optimization guidance so that I don't introduce regressions in rendering, timeline performance, or bundle size.

#### Acceptance Criteria

1. WHEN performance requirements exist THEN the skill SHALL enforce measure-first approach (profile before optimizing)
2. WHEN a change touches rendering code THEN the skill SHALL check for common anti-patterns (N+1 queries, unbounded data, unnecessary re-renders)
3. IF Core Web Vitals targets are defined THEN the skill SHALL verify against them

#### Correctness Properties

- **Property 1:** No optimization SHALL be applied without before/after measurements
- **Property 2:** Performance work SHALL NOT change behavior — only speed

### Requirement 5: Ensure Skills Are Model-Agnostic

**User Story:** As a developer, I want the skills to work regardless of which AI model powers the agent so that I'm not locked into a specific provider.

#### Acceptance Criteria

1. WHEN a skill is loaded THEN it SHALL work with any LLM backend (Claude, GPT, Gemini, etc.)
2. IF a skill references tool-specific commands THEN those SHALL be adapted to OpenCode's tool interface
3. WHEN a skill mentions cross-model escalation THEN it SHALL use whatever models are available

#### Correctness Properties

- **Property 1:** No skill SHALL contain hardcoded references to a specific agent platform (Claude, Cursor, etc.)
- **Property 2:** All skill workflows SHALL be expressible as plain markdown instructions
