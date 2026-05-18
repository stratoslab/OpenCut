"use client";

import { useState, useCallback, useEffect } from "react";
import { useEditor } from "@/editor/use-editor";
import { useAiModelStore } from "@/ai/ai-model-store";
import type { EditingPlan, PlanStep } from "@/ai/types";
import { AiAgent } from "@/ai/agent";
import { cn } from "@/utils/ui";

const QUICK_PRESETS = [
  { label: "Trim silence", goal: "Remove silent sections from the beginning and end" },
  { label: "Add intro transition", goal: "Add a smooth crossfade transition between all clips" },
  { label: "Normalize audio", goal: "Normalize audio levels across all clips" },
  { label: "Split at markers", goal: "Split clips at each bookmark position" },
  { label: "Add captions", goal: "Add subtitle track from transcript" },
  { label: "Auto duck music", goal: "Duck background music when speech is present" },
];

export function AiAgentPanel() {
  const editor = useEditor();
  const {
    stage,
    progress,
    currentFile,
    estimatedTimeRemaining,
    error,
    tps,
    isGenerating,
    gpuAdapter,
    shaderF16,
    downloadRetry,
    downloadError,
    streamingOutput,
    worker,
    loadModel,
    resumeDownload,
    clearError,
    generate,
    interrupt,
    initWorker,
    terminateWorker,
  } = useAiModelStore();

  const [goal, setGoal] = useState("");
  const [plan, setPlan] = useState<EditingPlan | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [planError, setPlanError] = useState<string | null>(null);

  useEffect(() => {
    initWorker();
    return () => terminateWorker();
  }, []);

  const agent = new AiAgent();

  const handleGeneratePlan = useCallback(async () => {
    if (!goal.trim()) return;

    setIsPlanning(true);
    setPlanError(null);
    setPlan(null);

    try {
      const scene = editor.scenes.getActiveScene();
      const mainElements = scene.tracks.main.elements.map((e, i) => ({
        id: e.id,
        name: `Clip ${i + 1}`,
        duration: e.duration,
        startTime: e.startTime,
      }));

      const MAX_CHARS = 12_000;
      const rawTranscript = scene.transcript?.fullText;
      const transcript = rawTranscript
        ? rawTranscript.length > MAX_CHARS
          ? rawTranscript.slice(0, MAX_CHARS) + "... [truncated]"
          : rawTranscript
        : undefined;

      const wordTranscript = scene.transcript
        ? {
            words: scene.transcript.words.map(w => ({
              text: w.text,
              start: w.start,
              end: w.end,
            })),
            fullText: scene.transcript.fullText,
            language: scene.transcript.language,
            videoDuration: scene.transcript.videoDuration,
          }
        : undefined;

      const context = {
        duration: scene.tracks.main.elements.reduce((sum, e) => sum + e.duration, 0),
        trackCount: Object.keys(scene.tracks).length,
        mainTrackElements: mainElements,
        audioTrackCount: scene.tracks.audio?.length ?? 0,
        transcript,
        wordTranscript,
      };

      const generatedPlan = await agent.generatePlan(goal, context);
      setPlan(generatedPlan);
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : "Failed to generate plan");
    } finally {
      setIsPlanning(false);
    }
  }, [goal, editor]);

  const handleExecutePlan = useCallback(async () => {
    if (!plan) return;

    setIsExecuting(true);
    setPlanError(null);
    setTotalSteps(plan.steps.length);
    setCurrentStep(0);

    try {
      await agent.executePlan(plan, {
        onStepStart: (_step: PlanStep, index: number) => setCurrentStep(index + 1),
        onError: (_step: PlanStep, err: Error) => setPlanError(err.message),
      });
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : "Execution failed");
    } finally {
      setIsExecuting(false);
    }
  }, [plan, agent]);

  const handleCancel = useCallback(() => {
    agent.cancelExecution();
    setIsExecuting(false);
  }, [agent]);

  const handlePresetClick = useCallback((presetGoal: string) => {
    setGoal(presetGoal);
  }, []);

  const handleGenerate = useCallback(() => {
    if (!goal.trim()) return;
    generate([{ role: "user", content: goal }]);
  }, [goal, generate]);

  const planProgress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  if (stage === "checking") {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-muted-foreground">Checking GPU support...</p>
        </div>
      </div>
    );
  }

  if (stage === "unsupported") {
    return (
      <div className="flex flex-col h-full p-3 space-y-4">
        <div className="p-3 border-b">
          <h3 className="text-sm font-medium">AI Co-Pilot</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            WebGPU is required for local AI processing
          </p>
        </div>
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded space-y-2">
          <p className="text-xs font-medium text-destructive">WebGPU Not Available</p>
          <p className="text-xs text-muted-foreground">{error}</p>
          {gpuAdapter && (
            <p className="text-[10px] text-muted-foreground font-mono">GPU: {gpuAdapter}</p>
          )}
          {shaderF16 === false && (
            <p className="text-[10px] text-muted-foreground">
              shader-f16 is required. Try Chrome on a discrete GPU.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (stage === "downloading" || stage === "loading") {
    return (
      <div className="flex flex-col h-full p-3 space-y-4">
        <div className="p-3 border-b">
          <h3 className="text-sm font-medium">AI Co-Pilot</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {stage === "downloading" ? "Downloading model" : "Initializing model"}
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{currentFile || "Loading..."}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 bg-muted rounded overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            {estimatedTimeRemaining && (
              <p className="text-[10px] text-muted-foreground text-center">
                ~{estimatedTimeRemaining} remaining
              </p>
            )}
          </div>

          {downloadRetry && (
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded">
              <p className="text-[10px] text-amber-600">
                Connection lost — retrying ({downloadRetry.attempt}/{downloadRetry.maxRetries}) in {downloadRetry.delay}s...
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            <span>Gemma 4 E2B · q4f16 · ~2 GB</span>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="flex flex-col h-full p-3 space-y-4">
        <div className="p-3 border-b">
          <h3 className="text-sm font-medium">AI Co-Pilot</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {downloadError ? "Download Interrupted" : "Loading Failed"}
          </p>
        </div>

        <div className="space-y-3">
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded space-y-2">
            <p className="text-xs font-medium text-destructive">{error}</p>
            {downloadError && downloadError.cachedPercent > 0 && (
              <p className="text-[10px] text-muted-foreground">
                {downloadError.cachedPercent}% already cached — resuming will continue from where it left off
              </p>
            )}
          </div>

          <div className="flex gap-2">
            {downloadError && downloadError.cachedPercent > 0 ? (
              <button
                type="button"
                className="flex-1 py-2 px-3 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={resumeDownload}
              >
                Resume Download
              </button>
            ) : (
              <button
                type="button"
                className="flex-1 py-2 px-3 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => {
                  clearError();
                  loadModel();
                }}
              >
                Retry
              </button>
            )}
            <button
              type="button"
              className="py-2 px-3 text-xs font-medium rounded border hover:bg-muted"
              onClick={() => clearError()}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "idle") {
    return (
      <div className="flex flex-col h-full p-3 space-y-4">
        <div className="p-3 border-b">
          <h3 className="text-sm font-medium">AI Co-Pilot</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Local AI powered by Gemma 4 — runs entirely in your browser
          </p>
        </div>

        <div className="space-y-3">
          <div className="p-3 bg-muted/50 border rounded space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-xs font-medium">WebGPU Ready</span>
            </div>
            {gpuAdapter && (
              <p className="text-[10px] text-muted-foreground font-mono">GPU: {gpuAdapter}</p>
            )}
            <p className="text-[10px] text-muted-foreground">
              Gemma 4 E2B · q4f16 · ~2 GB download required
            </p>
          </div>

          <button
            type="button"
            className="w-full py-2 px-3 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={loadModel}
          >
            Load Gemma 4 Model
          </button>
        </div>
      </div>
    );
  }

  if (stage === "ready") {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">AI Co-Pilot</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Describe what you want to do, or use a quick preset
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              <span className="text-[10px] text-muted-foreground">
                {tps ? `${tps.toFixed(1)} t/s` : "Ready"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {isGenerating && (
            <div className="p-3 bg-muted/50 border rounded space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-medium">Generating...</span>
              </div>
              {streamingOutput && (
                <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground max-h-32 overflow-y-auto">
                  {streamingOutput}
                </pre>
              )}
              <button
                type="button"
                className="text-[10px] text-destructive hover:underline"
                onClick={interrupt}
              >
                Cancel
              </button>
            </div>
          )}

          {!isExecuting && !plan && !isGenerating && (
            <>
              <div className="space-y-2">
                <label className="text-xs font-medium">Goal</label>
                <textarea
                  className="w-full text-xs bg-background border rounded p-2 resize-none"
                  rows={3}
                  placeholder="e.g., Split the video at each scene change and add crossfades"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  disabled={isPlanning}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  className={cn(
                    "flex-1 py-2 px-3 text-xs font-medium rounded transition-colors",
                    !goal.trim() || isPlanning
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                  onClick={handleGeneratePlan}
                  disabled={!goal.trim() || isPlanning}
                >
                  {isPlanning ? "Generating plan..." : "Generate Plan"}
                </button>
                <button
                  type="button"
                  className={cn(
                    "py-2 px-3 text-xs font-medium rounded transition-colors",
                    !goal.trim()
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                  )}
                  onClick={handleGenerate}
                  disabled={!goal.trim()}
                >
                  Chat
                </button>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-medium">Quick Presets</span>
                <div className="grid grid-cols-2 gap-1">
                  {QUICK_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      className="text-xs py-1.5 px-2 border rounded hover:bg-muted transition-colors text-left"
                      onClick={() => handlePresetClick(preset.goal)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {plan && !isExecuting && !isGenerating && (
            <div className="space-y-3">
              <div className="space-y-2">
                <span className="text-xs font-medium">Plan ({plan.steps.length} steps)</span>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {plan.steps.map((step, index) => (
                    <StepItem key={step.id} step={step} index={index} />
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 py-2 px-3 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={handleExecutePlan}
                >
                  Execute
                </button>
                <button
                  type="button"
                  className="py-2 px-3 text-xs font-medium rounded border hover:bg-muted"
                  onClick={() => {
                    setPlan(null);
                    setGoal("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {isExecuting && !isGenerating && (
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="h-1 bg-muted rounded overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${planProgress}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground text-center">
                  Step {currentStep} of {totalSteps}
                </p>
              </div>

              <button
                type="button"
                className="w-full py-2 px-3 text-xs font-medium rounded border border-destructive text-destructive hover:bg-destructive/10"
                onClick={handleCancel}
              >
                Cancel Execution
              </button>
            </div>
          )}

          {(planError || error) && (
            <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">
              {planError || error}
            </p>
          )}
        </div>
      </div>
    );
  }

  return null;
}

function StepItem({ step, index }: { step: PlanStep; index: number }) {
  return (
    <div className="flex gap-2 items-start p-2 border rounded bg-muted/30">
      <span className="text-[10px] font-mono text-muted-foreground mt-0.5">
        {index + 1}.
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium">{step.description}</p>
        <p className="text-[10px] text-muted-foreground font-mono">
          {step.actionType}
        </p>
      </div>
    </div>
  );
}
