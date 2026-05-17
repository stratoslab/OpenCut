"use client";

import { useState, useCallback } from "react";
import { useEditor } from "@/editor/use-editor";
import { EditorCore } from "@/core";
import { detectScenes, type SceneChange } from "@/video/scene-detector";
import { updateSceneInArray } from "@/timeline/scenes";
import type { Bookmark } from "@/timeline";
import { getFrameTime } from "@/timeline/bookmarks/index";
import { roundMediaTime } from "@/wasm";
import { cn } from "@/utils/ui";

export function SceneDetectPanel() {
  const editor = useEditor();
  const mediaAssets = useEditor((e) => e.media.getAssets());

  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [intervalSec, setIntervalSec] = useState(1);
  const [threshold, setThreshold] = useState(0.5);
  const [isDetecting, setIsDetecting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scenes, setScenes] = useState<SceneChange[]>([]);
  const [error, setError] = useState<string | null>(null);

  const videoAssets = mediaAssets.filter((a) => a.type === "video");
  const selectedAsset = videoAssets.find((a) => a.id === selectedMediaId);

  const handleDetect = useCallback(async () => {
    if (!selectedAsset?.file) return;

    setIsDetecting(true);
    setProgress(0);
    setScenes([]);
    setError(null);

    try {
      const results = await detectScenes(selectedAsset.file, {
        intervalSec,
        threshold,
        onProgress: (p) => setProgress(p),
      });
      setScenes(results);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Detection cancelled");
      } else {
        setError(err instanceof Error ? err.message : "Detection failed");
      }
    } finally {
      setIsDetecting(false);
    }
  }, [selectedAsset, intervalSec, threshold]);

  const handleAddMarkers = useCallback(() => {
    if (scenes.length === 0) return;

    const editor = EditorCore.getInstance();
    const activeScene = editor.scenes.getActiveScene();
    const activeProject = editor.project.getActive();
    if (!activeScene || !activeProject) return;

    const newBookmarks: Bookmark[] = scenes.map((change, index) => ({
      time: getFrameTime({
        time: roundMediaTime({ time: change.timestamp }),
        fps: activeProject.settings.fps,
      }),
      note: `Scene ${index + 1}`,
      color: "#6366f1",
    }));

    const mergedBookmarks = [...activeScene.bookmarks, ...newBookmarks].sort(
      (a, b) => a.time - b.time,
    );

    const updatedScenes = updateSceneInArray({
      scenes: editor.scenes.getScenes(),
      sceneId: activeScene.id,
      updates: { bookmarks: mergedBookmarks },
    });

    editor.scenes.setScenes({ scenes: updatedScenes });
  }, [scenes]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <h3 className="text-sm font-medium">Scene Detection</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Detect scene boundaries using color histogram analysis
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-medium">Video</label>
          <select
            className="w-full text-xs bg-background border rounded px-2 py-1.5"
            value={selectedMediaId ?? ""}
            onChange={(e) => setSelectedMediaId(e.target.value || null)}
            disabled={isDetecting}
          >
            <option value="">Select a video...</option>
            {videoAssets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium">
            Interval: {intervalSec}s
          </label>
          <input
            type="range"
            min="0.5"
            max="5"
            step="0.5"
            value={intervalSec}
            onChange={(e) => setIntervalSec(Number(e.target.value))}
            disabled={isDetecting}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>0.5s</span>
            <span>5s</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium">
            Threshold: {threshold.toFixed(2)}
          </label>
          <input
            type="range"
            min="0.1"
            max="2"
            step="0.05"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            disabled={isDetecting}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Sensitive</span>
            <span>Strict</span>
          </div>
        </div>

        <button
          type="button"
          className={cn(
            "w-full py-2 px-3 text-xs font-medium rounded transition-colors",
            !selectedAsset || isDetecting
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
          onClick={handleDetect}
          disabled={!selectedAsset || isDetecting}
        >
          {isDetecting ? "Detecting..." : "Detect Scenes"}
        </button>

        {isDetecting && (
          <div className="space-y-1">
            <div className="h-1 bg-muted rounded overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              {Math.round(progress)}%
            </p>
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">
            {error}
          </p>
        )}

        {scenes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">
                {scenes.length} scene{scenes.length !== 1 ? "s" : ""} detected
              </span>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={handleAddMarkers}
              >
                Add markers
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {scenes.map((scene, index) => (
                <div
                  key={index}
                  className="flex gap-2 p-2 border rounded bg-muted/30"
                >
                  {scene.beforeThumbnail && (
                    <img
                      src={scene.beforeThumbnail}
                      alt="Before"
                      className="w-16 h-9 object-cover rounded"
                    />
                  )}
                  {scene.afterThumbnail && (
                    <img
                      src={scene.afterThumbnail}
                      alt="After"
                      className="w-16 h-9 object-cover rounded"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">
                      {formatTimestamp(scene.timestamp)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {scene.type} · χ² = {scene.chiSquaredDistance.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
