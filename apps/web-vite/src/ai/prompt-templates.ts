import type { ProjectContext } from "./types";
import { ACTION_TYPES } from "./types";

export function buildPlanPrompt(goal: string, context: ProjectContext): string {
  const clipsDescription = context.mainTrackElements
    .map((e) => `${e.name}: ${e.duration}s at ${e.startTime}s`)
    .join(", ");

  const escapedTranscript = context.transcript
    ? context.transcript.replace(/`/g, "'").replace(/\$\{/g, "$ {")
    : undefined;

  return `You are a video editing assistant. Given the project state below, create a step-by-step plan to achieve: "${goal}"

Project:
- Duration: ${context.duration}s
- Tracks: ${context.trackCount} (main: ${context.mainTrackElements.length} elements, audio: ${context.audioTrackCount})
- Clips: [${clipsDescription}]
- Transcript: ${escapedTranscript ?? "none"}

Available actions: ${ACTION_TYPES.join(", ")}

Return a JSON object with a "steps" array. Each step must have:
- "actionType": one of the available actions
- "description": what this step does
- "params": parameters for the action
- "targetElementId": which clip to modify (if applicable)

Example response:
{
  "steps": [
    {
      "actionType": "split-clip",
      "description": "Split the intro clip at 5 seconds",
      "params": { "time": 5 },
      "targetElementId": "clip-1"
    },
    {
      "actionType": "add-transition",
      "description": "Add crossfade between clips",
      "params": { "type": "crossfade", "duration": 0.5 }
    }
  ]
}

Return ONLY valid JSON, no markdown or explanation.`;
}

export function buildDescriptionPrompt(
  videoTitle: string,
  chapters: string,
  transcript?: string,
): string {
  return `Generate a YouTube video description for: "${videoTitle}"

Chapters:
${chapters}

${transcript ? `Transcript excerpt:\n${transcript}\n\n` : ""}

Return a JSON object with:
- "title": engaging video title
- "description": full description with chapters embedded
- "tags": array of relevant tags

Return ONLY valid JSON.`;
}
