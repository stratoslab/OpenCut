# Requirements: Command Palette

## Introduction

A VS Code-style command palette (Cmd+Shift+P) that provides fuzzy-searchable access to all editor actions, panel navigation, and keyboard shortcuts. Serves as a universal discovery and execution interface for users who prefer keyboard-driven workflows or need to find features they don't know the location of.

## Glossary

- **Command Palette**: A modal overlay with a text input that filters a list of available commands
- **Fuzzy Search**: Matching algorithm that finds commands even with partial, non-contiguous input
- **Action**: Any executable operation in the editor (e.g., "Split Clip", "Toggle Play", "Add Text")
- **Quick Access**: Direct navigation to a panel or view without using the sidebar tabs

## Requirements

### Requirement 1: Command Discovery and Search

**User Story:** As a user, I want to search for any editor action by typing, so that I can find and execute commands without navigating menus

#### Acceptance Criteria

1. WHEN the user presses Cmd+Shift+P (or Ctrl+Shift+P) THEN the system SHALL open a modal command palette overlay
2. WHEN the user types into the palette THEN the system SHALL filter commands using fuzzy matching against command labels and aliases
3. IF no commands match the search THEN the system SHALL display "No matching commands"
4. WHEN the palette is open THEN the system SHALL display commands grouped by category (Editing, Navigation, View, AI, Export)
5. WHILE the palette is open THEN the system SHALL highlight the first matching result and allow arrow key navigation

#### Correctness Properties

- **Property 1:** Fuzzy search SHALL match any subsequence of characters in command labels (e.g., "sc" matches "Split Clip")
- **Property 2:** Search SHALL be case-insensitive
- **Property 3:** All registered editor actions SHALL be discoverable through the palette

### Requirement 2: Command Execution

**User Story:** As a user, I want to execute a command by selecting it from the palette, so that I can perform actions without using the mouse

#### Acceptance Criteria

1. WHEN the user presses Enter on a selected command THEN the system SHALL execute that command
2. WHEN a command requires parameters THEN the system SHALL prompt for input after selection
3. IF a command is not available in the current context THEN the system SHALL either hide it or show it as disabled with a reason
4. WHEN a command executes THEN the system SHALL close the palette

#### Correctness Properties

- **Property 1:** Executing a command through the palette SHALL produce the same result as executing it through the UI
- **Property 2:** Commands that modify state SHALL be undoable via Ctrl+Z after palette execution

### Requirement 3: Keyboard Shortcut Display

**User Story:** As a user, I want to see keyboard shortcuts next to commands, so that I can learn and memorize shortcuts over time

#### Acceptance Criteria

1. WHEN a command has a keyboard shortcut THEN the system SHALL display it aligned to the right of the command label
2. WHEN the user hovers over a command THEN the system SHALL highlight the shortcut
3. IF a command has no shortcut THEN the system SHALL not display a shortcut column

#### Correctness Properties

- **Property 1:** Shortcut display SHALL be consistent with the actual keybinding registry
- **Property 2:** Platform-specific shortcuts SHALL be shown (Cmd on macOS, Ctrl on Windows/Linux)

### Requirement 4: Panel Navigation

**User Story:** As a user, I want to quickly switch between panels using the command palette, so that I can navigate without clicking sidebar tabs

#### Acceptance Criteria

1. WHEN the user searches for a panel name (e.g., "media", "effects", "AI") THEN the system SHALL show panel navigation commands
2. WHEN the user selects a panel command THEN the system SHALL switch to that panel and close the palette

#### Correctness Properties

- **Property 1:** All visible panels SHALL be accessible via the palette
- **Property 2:** Switching panels SHALL preserve the current timeline state
