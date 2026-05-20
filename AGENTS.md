# Agents.md

## Architecture

An ongoing migration is moving all business logic into `rust/`. Each app under `apps/` is a UI shell — it owns rendering, interaction, and platform-specific concerns, but never owns logic. The UI framework for any given app is a replaceable detail.

### `rust/`

The single source of truth for all non-UI code. Everything platform-agnostic belongs here: no components, no hooks, no framework imports.

### `apps/`

Each app is a frontend that calls into Rust. Logic is never duplicated between apps — only UI is, because each platform may use an entirely different framework and language to build it.

- `web/` — Next.js
- `desktop/` — GPUI

## Web

### React

- Read components before using them. They may already apply classes, which affects what you need to pass and how to override them.

## Skills

Installed skills that guide engineering workflows. Load the relevant skill when the trigger conditions match.

### context-engineering
- **Trigger:** Starting a session, switching tasks, agent output degrades, or context needs setup
- **What:** Curates what the agent sees, when it sees it. Uses the context hierarchy: rules files → specs → source files → errors → conversation
- **Key pattern:** Before editing, read the file, find an existing similar pattern, read relevant types

### debugging-and-error-recovery
- **Trigger:** Tests fail, build breaks, unexpected behavior, errors in logs/console, something stopped working
- **What:** Systematic triage: Reproduce → Localize → Reduce → Fix → Guard → Verify
- **Key rule:** Stop-the-Line — never push past a failing test or broken build to work on the next feature

### performance-optimization
- **Trigger:** Performance requirements exist, suspected regressions, Core Web Vitals below thresholds, profiling reveals bottlenecks
- **What:** Measure-first approach. Profile before optimizing, identify the actual bottleneck, fix it, measure again
- **Key rule:** Never optimize without measurement. Performance work without profiling is guessing

### doubt-driven-development
- **Trigger:** Non-trivial decisions (branching logic, module boundaries, invariants the type system can't verify, irreversible changes, high-stakes code)
- **What:** Adversarial fresh-context review: CLAIM → EXTRACT → DOUBT → RECONCILE → STOP
- **Key rule:** Pass ARTIFACT + CONTRACT to the reviewer, never the CLAIM. The reviewer must be adversarial, not validating

### code-simplification
- **Trigger:** Code works but is harder to read than it should be, accumulated complexity, after feature completion
- **What:** Reduce complexity while preserving exact behavior. Chesterton's Fence — understand before changing
- **Key rule:** Separate refactoring from feature work. Mixed changes are harder to review and revert

