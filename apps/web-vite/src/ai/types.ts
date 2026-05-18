export const ACTION_TYPES = [
  "split-clip",
  "delete-clip",
  "trim-start",
  "trim-end",
  "add-transition",
  "remove-transition",
  "add-effect",
  "remove-effect",
  "mute-audio",
  "unmute-audio",
  "adjust-volume",
  "add-text",
  "delete-text",
  "retime-clip",
  "add-marker",
  "delete-marker",
  "normalize-audio",
  "auto-duck",
  "add-caption",
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

export interface PlanStep {
  id: string;
  actionType: ActionType;
  description: string;
  params: Record<string, unknown>;
  targetElementId?: string;
  targetTrackId?: string;
}

export interface EditingPlan {
  id: string;
  goal: string;
  steps: PlanStep[];
  estimatedDuration: number;
}

export interface ProjectContext {
  duration: number;
  trackCount: number;
  mainTrackElements: { id: string; name: string; duration: number; startTime: number }[];
  audioTrackCount: number;
  transcript?: string;
  wordTranscript?: {
    words: { text: string; start: number; end: number }[];
    fullText: string;
    language?: string;
    videoDuration?: number;
  };
}

export interface PlanCallbacks {
  onStepStart?: (step: PlanStep, index: number, total: number) => void;
  onStepComplete?: (step: PlanStep, index: number) => void;
  onError?: (step: PlanStep, error: Error) => void;
  onComplete?: () => void;
}

export function isValidActionType(action: string): action is ActionType {
  return (ACTION_TYPES as readonly string[]).includes(action);
}

export function validatePlan(plan: EditingPlan): { valid: boolean; error?: string } {
  if (plan.steps.length === 0) {
    return { valid: false, error: "Plan has no steps" };
  }

  for (const step of plan.steps) {
    if (!isValidActionType(step.actionType)) {
      return { valid: false, error: `Invalid action type: ${step.actionType}` };
    }
  }

  return { valid: true };
}
