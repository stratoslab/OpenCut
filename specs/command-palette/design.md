# Design: Command Palette

## Overview

A modal overlay component with a text input that filters a flat list of registered commands using fuzzy matching. Commands are grouped by category and display keyboard shortcuts. Built as a standalone component that reads from a centralized command registry.

## Architecture

```
┌─────────────────────────────────────────┐
│           Command Palette Modal          │
│  ┌─────────────────────────────────────┐ │
│  │ [Search input]                      │ │
│  ├─────────────────────────────────────┤ │
│  │ Editing                             │ │
│  │   Split Clip          Cmd+Shift+S   │ │
│  │   Delete Clip         Delete        │ │
│  ├─────────────────────────────────────┤ │
│  │ Navigation                          │ │
│  │   Go to Start         Home          │ │
│  │   Go to End           End           │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
         ▲
         │ reads from
┌────────┴─────────────────────────────────┐
│          Command Registry                 │
│  - All editor actions                     │
│  - Panel navigation commands              │
│  - Keyboard shortcuts                     │
│  - Category labels                        │
│  - Availability predicates                │
└──────────────────────────────────────────┘
```

## Components

### Component 1: CommandRegistry
- **Responsibility:** Central registry of all available commands with metadata (label, category, shortcut, action, availability predicate)
- **Interface:** `register(command)`, `getAll()`, `search(query): Command[]`
- **Dependencies:** None (pure data structure)
- **Key design:** Fuzzy matching uses character subsequence scoring — higher score for contiguous matches, prefix matches, and exact matches

### Component 2: CommandPalette Component
- **Responsibility:** Modal overlay with search input, filtered results list, keyboard navigation, and command execution
- **Interface:** React component, triggered by Cmd+Shift+P
- **Dependencies:** CommandRegistry, EditorCore (for command execution)
- **Key design:** Uses `useSyncExternalStore` for reactive filtering. Closes on Escape, executes on Enter, navigates with arrow keys

### Component 3: FuzzyMatcher
- **Responsibility:** Score and rank commands based on search query
- **Interface:** `match(query: string, label: string): number` — returns score (0 = no match, higher = better)
- **Dependencies:** None
- **Key design:** Scoring: exact match (100) > prefix match (80) > contiguous subsequence (60) > scattered subsequence (40) > no match (0)

## Data Models

```typescript
interface Command {
  id: string;
  label: string;
  category: "editing" | "navigation" | "view" | "ai" | "export" | "file";
  shortcut?: string;
  action: () => void | Promise<void>;
  available?: () => boolean;
  aliases?: string[];
}
```

## Data Flow

1. User presses Cmd+Shift+P → CommandPalette opens
2. User types → FuzzyMatcher scores all commands against query
3. Results sorted by score, grouped by category
4. User selects + presses Enter → `command.action()` executes
5. Palette closes, editor state updates

## Key Algorithms

### Fuzzy Matching
```
score(query, label):
  if query == label: return 100
  if label.startsWith(query): return 80
  if query is contiguous subsequence of label: return 60
  if query is scattered subsequence of label: return 40
  return 0
```

## Error Handling

- If command action throws → display error toast, keep palette open
- If no commands match → show "No matching commands" message
- If command is unavailable → show as disabled with tooltip explaining why

## Testing Strategy

- **Fuzzy matching:** Property-based tests verifying subsequence matching, case insensitivity, scoring order
- **Command registry:** Verify all registered actions are discoverable
- **Keyboard navigation:** Verify arrow keys, Enter, Escape behavior
- **Context availability:** Verify commands hide/disable based on editor state
