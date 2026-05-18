# Requirements: AI Co-Pilot Transcript Context

## Introduction

The AI Co-Pilot generates step-by-step editing plans from natural language goals. The type system and prompt template already support passing the video transcript as context, but the `AiAgentPanel` component never reads or includes it. This feature wires the existing transcript data — produced by the Whisper transcription system — into the AI Co-Pilot's plan generation, so the LLM can reference spoken content when suggesting edits.

## Glossary

| Term | Definition |
|------|-----------|
| **WordTranscript** | A type containing `{ words: WordSegment[], fullText: string, language: string, videoDuration: number }` — the output of the Whisper ONNX pipeline |
| **ProjectContext** | The typed object passed to `AiAgent.generatePlan()`, defined in `ai/types.ts`, containing `duration`, `trackCount`, `mainTrackElements`, `audioTrackCount`, and `transcript?: string` |
| **AiAgentPanel** | The React component in `ai/components/AiAgentPanel.tsx` that constructs the `ProjectContext` and triggers plan generation |
| **CaptionChunk** | The per-caption output of transcription, stored as subtitles/text tracks on the video element — distinct from the raw transcript text |
| **captions data store** | The mechanism by which generated captions are stored and made accessible to other components (currently captions are inserted directly as video text tracks with no intermediate store for the raw transcript text) |

## Requirements

### Requirement 1: Transcript Persistence After Transcription

**User Story:** As a user who has run transcription, I want the resulting transcript text to be accessible by other features (specifically the AI Co-Pilot), so that the AI can reference spoken content when generating edit plans.

#### Acceptance Criteria

1. WHEN a user runs transcription via the Captions panel THEN the system SHALL store the resulting `WordTranscript` (or at minimum the `fullText`) in a location accessible to the `AiAgentPanel`
2. WHEN the same scene's transcription is re-run THEN the system SHALL replace the stored transcript for that scene
3. IF transcription is cancelled or fails THEN the system SHALL clear or leave the stored transcript unchanged (no half-written state)

#### Correctness Properties

- **Property 1:** After successful transcription, `editor.scenes.getActiveScene()` (or equivalent) SHALL expose the transcript text such that any component can read it synchronously
- **Property 2:** The stored transcript SHALL be scoped to the active scene and cleared when the scene's captions track is removed

### Requirement 2: Include Transcript in AI Co-Pilot Context

**User Story:** As a user using the AI Co-Pilot, I want the transcript text to be included in the context sent to the LLM when generating an editing plan, so that the AI can make decisions based on spoken content (e.g., "cut the part where I introduce myself").

#### Acceptance Criteria

1. WHEN the user clicks "Generate Plan" in the AI Co-Pilot panel THEN the system SHALL include `context.transcript` populated with the stored transcript text (if one exists for the active scene)
2. WHEN no transcript exists for the active scene THEN `context.transcript` SHALL be `undefined` and the prompt template SHALL render "none" (existing behavior preserved)
3. WHEN the project has multiple scenes THEN only the active scene's transcript SHALL be included in the context
4. WHILE the transcript is very long (>4,000 tokens) THE system SHALL truncate or summarize it to fit within the LLM's context window without breaking the plan generation prompt

#### Correctness Properties

- **Property 1:** The transcript field in ProjectContext SHALL be populated with the full text of the active scene's transcript, or `undefined` if none exists
- **Property 2:** The prompt template output SHALL be valid JSON-compatible text regardless of transcript content (the transcript text MUST be escaped if it contains characters that would break the prompt template)

### Requirement 3: Coexistence with Gemma ChatPanel

**User Story:** As a developer, I want the transcript data to be shared between both the AI Co-Pilot and the existing Gemma ChatPanel, so that both AI features work from the same source of truth.

#### Acceptance Criteria

1. WHERE both the AI Co-Pilot and Gemma ChatPanel need the same transcript THE system SHALL read from a single source of truth (no duplicate storage)
2. WHEN the user generates a new transcript AFTER having already interacted with either AI feature THEN both features SHALL reflect the new transcript on the next interaction
3. WHERE transcript data is stored per-scene THE system SHALL ensure scene switches propagate to both features

#### Correctness Properties

- **Property 1:** There SHALL be exactly one mechanism for storing transcript text per scene, shared by all consumers
- **Property 2:** All consumers SHALL read from the same observable source (scene-track property, Zustand store, or editor manager)

## Out of Scope

- Storing multiple transcripts per scene (the system currently supports one transcript per scene)
- Transcript-based editing itself (handled by the TextEditEngine component)
- Voice activity detection or audio pre-processing for better transcription quality
- Multi-language transcript storage
