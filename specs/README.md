# StratosCut Specs

Structured spec documents for planned features. Each feature follows the spec-workflow: requirements → design → tasks, with user approval gates between each phase.

## Directory Structure

```
specs/
├── README.md                          ← this file
├── ai-copilot-transcript-context/     ← Wire transcript into AI Co-Pilot context
├── ai-features/                       ← Overall AI feature architecture
├── audio-analysis/                    ← Beat detection, auto-duck, loudness normalization
├── background-removal/                ← WASM-based image background removal
├── broll-suggestions/                 ← Transcript analysis → B-roll search suggestions
├── command-palette/                   ← ⌘K command palette for keyboard-driven editing
├── onboarding-flow/                   ← First-run onboarding modal
├── quick-actions-bar/                 ← Post-transcription one-click action bar
├── smart-cut/                         ← AI-powered silence/filler removal
├── smart-suggestions/                 ← Floating suggestion cards
├── subtitle-style-editor/             ← Subtitle font/color/animation customization
└── version-control/                   ← Commit-based project versioning
```

## Spec Template

Each feature directory contains three documents:

| Document | Purpose | Key Sections |
|----------|---------|-------------|
| `requirements.md` | What the feature must do | Introduction, Glossary, Requirements (user stories, EARS acceptance criteria, correctness properties) |
| `design.md` | How the feature will be built | Overview, Architecture, Components, Data Models, Data Flow, Error Handling, Testing Strategy, Requirements Traceability |
| `tasks.md` | Ordered implementation tasks | Dependency graph, task list with Done-when criteria, property-based test tasks |

## Cross-Reference Map

Specs often reference each other where features compose or share infrastructure:

| Source Spec | References |
|-------------|-----------|
| quick-actions-bar | smart-cut |

## Status

All 12 specs have all three documents. Implementation readiness varies:

| Spec | Requirements Clarity | Design Depth | Task Granularity |
|------|---------------------|-------------|-----------------|
| ai-copilot-transcript-context | High — 3 well-defined requirements | Deep — architecture, data flow, traceability | Fine — 7 tasks with PBTs |
| ai-features | High — comprehensive | Deep | Fine |
| audio-analysis | Medium | Adequate — 3 components defined | Adequate |
| background-removal | Medium | Adequate | Adequate |
| broll-suggestions | Medium | Adequate — data model defined | Adequate |
| command-palette | High | Deep — full architecture | Fine |
| onboarding-flow | Medium | Adequate | Adequate |
| quick-actions-bar | Medium | Adequate | Adequate — 3 tasks |
| smart-cut | High | Deep | Fine |
| smart-suggestions | Medium | Adequate | Adequate |
| subtitle-style-editor | High | Deep — full data model | Adequate |
| version-control | Medium | Deep — full data model | Adequate |

## Conventions

- Feature names are `kebab-case` (e.g., `ai-copilot-transcript-context`)
- Requirements use EARS format: WHERE/WHILE/WHEN/IF + THEN + SHALL
- Every requirement has at least one correctness property (formal invariant)
- Every task has explicit "Done when:" criteria and "Depends on:" declarations
- Design docs trace back to requirements
