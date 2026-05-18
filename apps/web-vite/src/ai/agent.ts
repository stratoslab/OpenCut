import type { EditingPlan, ProjectContext, PlanCallbacks } from "./types";
import { validatePlan, isValidActionType, ACTION_TYPES } from "./types";
import { buildPlanPrompt } from "./prompt-templates";
import { EditorCore } from "@/core";
import {
	SplitElementsCommand,
	DeleteElementsCommand,
	UpdateElementsCommand,
	InsertElementCommand,
	AddClipEffectCommand,
	RemoveClipEffectCommand,
	UpdateClipEffectParamsCommand,
	ToggleTrackMuteCommand,
} from "@/commands";
import type { MediaTime } from "@/wasm";

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

  const editor = EditorCore.getInstance();
  const { params, targetElementId, targetTrackId } = step;

  switch (step.actionType) {
    case "split-clip": {
      if (!targetElementId || !targetTrackId) {
        throw new Error("split-clip requires targetElementId and targetTrackId");
      }
      const splitTime = params.splitTime as MediaTime;
      if (!splitTime) {
        throw new Error("split-clip requires splitTime parameter");
      }
      editor.command.execute({
        command: new SplitElementsCommand({
          elements: [{ trackId: targetTrackId, elementId: targetElementId }],
          splitTime,
        }),
      });
      break;
    }

    case "delete-clip": {
      if (!targetElementId || !targetTrackId) {
        throw new Error("delete-clip requires targetElementId and targetTrackId");
      }
      editor.command.execute({
        command: new DeleteElementsCommand({
          elements: [{ trackId: targetTrackId, elementId: targetElementId }],
        }),
      });
      break;
    }

    case "trim-start": {
      if (!targetElementId || !targetTrackId) {
        throw new Error("trim-start requires targetElementId and targetTrackId");
      }
      const newStart = params.startTime as MediaTime;
      if (newStart === undefined) {
        throw new Error("trim-start requires startTime parameter");
      }
      editor.command.execute({
        command: new UpdateElementsCommand({
          updates: [{
            trackId: targetTrackId,
            elementId: targetElementId,
            patch: { startTime: newStart },
          }],
        }),
      });
      break;
    }

    case "trim-end": {
      if (!targetElementId || !targetTrackId) {
        throw new Error("trim-end requires targetElementId and targetTrackId");
      }
      const newDuration = params.duration as MediaTime;
      if (newDuration === undefined) {
        throw new Error("trim-end requires duration parameter");
      }
      editor.command.execute({
        command: new UpdateElementsCommand({
          updates: [{
            trackId: targetTrackId,
            elementId: targetElementId,
            patch: { duration: newDuration },
          }],
        }),
      });
      break;
    }

    case "add-transition": {
      if (!targetElementId || !targetTrackId) {
        throw new Error("add-transition requires targetElementId and targetTrackId");
      }
      const transitionType = params.type as string || "crossfade";
      const duration = params.duration as MediaTime || { seconds: 1, ticks: 0 };
      editor.command.execute({
        command: new UpdateElementsCommand({
          updates: [{
            trackId: targetTrackId,
            elementId: targetElementId,
            patch: { transition: { type: transitionType, duration } },
          }],
        }),
      });
      break;
    }

    case "remove-transition": {
      if (!targetElementId || !targetTrackId) {
        throw new Error("remove-transition requires targetElementId and targetTrackId");
      }
      editor.command.execute({
        command: new UpdateElementsCommand({
          updates: [{
            trackId: targetTrackId,
            elementId: targetElementId,
            patch: { transition: null },
          }],
        }),
      });
      break;
    }

    case "add-effect": {
      if (!targetElementId || !targetTrackId) {
        throw new Error("add-effect requires targetElementId and targetTrackId");
      }
      const effectType = params.effectType as string;
      if (!effectType) {
        throw new Error("add-effect requires effectType parameter");
      }
      const cmd = new AddClipEffectCommand({
        trackId: targetTrackId,
        elementId: targetElementId,
        effectType,
      });
      editor.command.execute({ command: cmd });
      const effectId = cmd.getEffectId();
      const effectParams = params.effectParams as Record<string, unknown> | undefined;
      if (effectId && effectParams && Object.keys(effectParams).length > 0) {
        editor.command.execute({
          command: new UpdateClipEffectParamsCommand({
            trackId: targetTrackId,
            elementId: targetElementId,
            effectId,
            params: effectParams,
          }),
        });
      }
      break;
    }

    case "remove-effect": {
      if (!targetElementId || !targetTrackId) {
        throw new Error("remove-effect requires targetElementId and targetTrackId");
      }
      const effectId = params.effectId as string;
      if (!effectId) {
        throw new Error("remove-effect requires effectId parameter");
      }
      editor.command.execute({
        command: new RemoveClipEffectCommand({
          trackId: targetTrackId,
          elementId: targetElementId,
          effectId,
        }),
      });
      break;
    }

    case "mute-audio": {
      const trackId = targetTrackId || params.trackId as string;
      if (!trackId) {
        throw new Error("mute-audio requires trackId");
      }
      editor.command.execute({
        command: new ToggleTrackMuteCommand(trackId),
      });
      break;
    }

    case "unmute-audio": {
      const trackId = targetTrackId || params.trackId as string;
      if (!trackId) {
        throw new Error("unmute-audio requires trackId");
      }
      editor.command.execute({
        command: new ToggleTrackMuteCommand(trackId),
      });
      break;
    }

    case "adjust-volume": {
      const trackId = targetTrackId || params.trackId as string;
      if (!trackId) {
        throw new Error("adjust-volume requires trackId");
      }
      const volume = params.volume as number;
      if (volume === undefined) {
        throw new Error("adjust-volume requires volume parameter");
      }
      const scene = editor.scenes.getActiveSceneOrNull();
      if (!scene) return;
      const audioTracks = scene.tracks.audio.map(t =>
        t.id === trackId ? { ...t, volume } : t
      );
      editor.timeline.updateTracks({ ...scene.tracks, audio: audioTracks });
      break;
    }

    case "add-text": {
      const text = params.text as string;
      if (!text) {
        throw new Error("add-text requires text parameter");
      }
      const trackId = targetTrackId || "overlay-1";
      editor.command.execute({
        command: new InsertElementCommand({
          element: {
            id: crypto.randomUUID(),
            type: "text",
            name: text,
            startTime: params.startTime as MediaTime || { seconds: 0, ticks: 0 },
            duration: params.duration as MediaTime || { seconds: 3, ticks: 0 },
            trimStart: { seconds: 0, ticks: 0 },
            trimEnd: { seconds: 0, ticks: 0 },
            content: { text },
            animations: [],
            effects: [],
          },
          placement: { mode: "explicit", trackId },
        }),
      });
      break;
    }

    case "delete-text": {
      if (!targetElementId || !targetTrackId) {
        throw new Error("delete-text requires targetElementId and targetTrackId");
      }
      editor.command.execute({
        command: new DeleteElementsCommand({
          elements: [{ trackId: targetTrackId, elementId: targetElementId }],
        }),
      });
      break;
    }

    case "retime-clip": {
      if (!targetElementId || !targetTrackId) {
        throw new Error("retime-clip requires targetElementId and targetTrackId");
      }
      const speed = params.speed as number;
      if (speed === undefined) {
        throw new Error("retime-clip requires speed parameter");
      }
      editor.command.execute({
        command: new UpdateElementsCommand({
          updates: [{
            trackId: targetTrackId,
            elementId: targetElementId,
            patch: { retime: { speed } },
          }],
        }),
      });
      break;
    }

    case "add-marker": {
      const time = params.time as MediaTime;
      if (!time) {
        throw new Error("add-marker requires time parameter");
      }
      const scene = editor.scenes.getActiveSceneOrNull();
      if (!scene) return;
      const marker = {
        id: crypto.randomUUID(),
        time,
        label: (params.label as string) || "",
        color: (params.color as string) || "#FFD700",
      };
      editor.timeline.addMarker(marker);
      break;
    }

    case "delete-marker": {
      const markerId = params.markerId as string;
      if (!markerId) {
        throw new Error("delete-marker requires markerId parameter");
      }
      editor.timeline.removeMarker(markerId);
      break;
    }

    case "normalize-audio": {
      const trackId = targetTrackId || params.trackId as string;
      if (!trackId) {
        throw new Error("normalize-audio requires trackId");
      }
      const scene = editor.scenes.getActiveSceneOrNull();
      if (!scene) return;
      const audioTracks = scene.tracks.audio.map(t =>
        t.id === trackId ? { ...t, normalized: true } : t
      );
      editor.timeline.updateTracks({ ...scene.tracks, audio: audioTracks });
      break;
    }

    case "auto-duck": {
      const trackId = targetTrackId || params.trackId as string;
      if (!trackId) {
        throw new Error("auto-duck requires trackId");
      }
      const threshold = params.threshold as number ?? -20;
      const reduction = params.reduction as number ?? -10;
      const scene = editor.scenes.getActiveSceneOrNull();
      if (!scene) return;
      const audioTracks = scene.tracks.audio.map(t =>
        t.id === trackId ? { ...t, autoDuck: { enabled: true, threshold, reduction } } : t
      );
      editor.timeline.updateTracks({ ...scene.tracks, audio: audioTracks });
      break;
    }

    case "add-caption": {
      const text = params.text as string;
      if (!text) {
        throw new Error("add-caption requires text parameter");
      }
      const trackId = targetTrackId || "overlay-1";
      editor.command.execute({
        command: new InsertElementCommand({
          element: {
            id: crypto.randomUUID(),
            type: "caption",
            name: text,
            startTime: params.startTime as MediaTime || { seconds: 0, ticks: 0 },
            duration: params.duration as MediaTime || { seconds: 2, ticks: 0 },
            trimStart: { seconds: 0, ticks: 0 },
            trimEnd: { seconds: 0, ticks: 0 },
            content: { text },
            animations: [],
            effects: [],
          },
          placement: { mode: "explicit", trackId },
        }),
      });
      break;
    }

    default: {
      throw new Error(`Unhandled action type: ${step.actionType}`);
    }
  }
}
