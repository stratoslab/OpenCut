import type { EditingPlan, ProjectContext, PlanCallbacks } from "./types";
import { validatePlan, isValidActionType, ACTION_TYPES } from "./types";
import { buildPlanPrompt } from "./prompt-templates";

export class AiAgent {
  private abortController: AbortController | null = null;

  async generatePlan(
    goal: string,
    context: ProjectContext,
  ): Promise<EditingPlan> {
    const prompt = buildPlanPrompt(goal, context);

    try {
      const response = await fetch("/api/gemma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          max_tokens: 2000,
        }),
        signal: this.abortController?.signal,
      });

      if (!response.ok) {
        throw new Error(`LLM request failed: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content ?? data.content;

      if (!content) {
        throw new Error("Empty response from LLM");
      }

      const parsed = parsePlanResponse(content);
      const validation = validatePlan(parsed);

      if (!validation.valid) {
        throw new Error(`Invalid plan: ${validation.error}`);
      }

      return parsed;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("Plan generation cancelled");
      }
      throw error;
    }
  }

  async executePlan(
    plan: EditingPlan,
    callbacks: PlanCallbacks = {},
  ): Promise<void> {
    this.abortController = new AbortController();

    for (let i = 0; i < plan.steps.length; i++) {
      if (this.abortController.signal.aborted) {
        throw new Error("Plan execution cancelled");
      }

      const step = plan.steps[i];
      callbacks.onStepStart?.(step, i, plan.steps.length);

      try {
        await executeStep(step);
        callbacks.onStepComplete?.(step, i);
      } catch (error) {
        callbacks.onError?.(step, error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    }

    callbacks.onComplete?.();
  }

  cancelExecution(): void {
    this.abortController?.abort();
  }
}

function parsePlanResponse(content: string): EditingPlan {
  let jsonStr = content.trim();

  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed = JSON.parse(jsonStr);

  if (!parsed.steps || !Array.isArray(parsed.steps)) {
    throw new Error("Response missing steps array");
  }

  return {
    id: crypto.randomUUID(),
    goal: "",
    steps: parsed.steps.map((step: Record<string, unknown>, index: number) => ({
      id: `step-${index}`,
      actionType: step.actionType as string,
      description: step.description as string,
      params: (step.params as Record<string, unknown>) ?? {},
      targetElementId: step.targetElementId as string | undefined,
      targetTrackId: step.targetTrackId as string | undefined,
    })),
    estimatedDuration: 0,
  };
}

async function executeStep(step: {
  actionType: string;
  params: Record<string, unknown>;
  targetElementId?: string;
  targetTrackId?: string;
}): Promise<void> {
  if (!isValidActionType(step.actionType)) {
    throw new Error(`Unknown action type: ${step.actionType}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 50));
}
