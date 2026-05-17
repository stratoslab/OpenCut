"use client";

import { useState, useCallback } from "react";
import { formatChapters, validateChapters, type Chapter } from "@/export/chapter-exporter";
import { cn } from "@/utils/ui";

export function YouTubeExportPanel() {
  const [chapters, setChapters] = useState<Chapter[]>([
    { timestamp: 0, title: "Introduction" },
  ]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formattedText = formatChapters(chapters);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(formattedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Failed to copy to clipboard");
    }
  }, [formattedText]);

  const handleAddChapter = useCallback(() => {
    const lastChapter = chapters[chapters.length - 1];
    const newTimestamp = lastChapter ? lastChapter.timestamp + 60 : 0;
    setChapters([...chapters, { timestamp: newTimestamp, title: `Chapter ${chapters.length + 1}` }]);
  }, [chapters]);

  const handleRemoveChapter = useCallback((index: number) => {
    if (chapters.length <= 1) return;
    setChapters(chapters.filter((_, i) => i !== index));
  }, [chapters]);

  const handleUpdateChapter = useCallback(
    (index: number, field: keyof Chapter, value: string | number) => {
      const updated = [...chapters];
      updated[index] = { ...updated[index], [field]: value };
      setChapters(updated);
    },
    [chapters],
  );

  const validation = validateChapters(chapters);
  if (!validation.valid && error === null) {
    setError(validation.error ?? null);
  } else if (validation.valid && error) {
    setError(null);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <h3 className="text-sm font-medium">YouTube Chapters</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Format and export chapter markers for YouTube
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Chapters</span>
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={handleAddChapter}
            >
              + Add
            </button>
          </div>

          <div className="space-y-1 max-h-48 overflow-y-auto">
            {chapters.map((chapter, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={chapter.timestamp}
                  onChange={(e) =>
                    handleUpdateChapter(index, "timestamp", Number(e.target.value))
                  }
                  className="w-16 text-xs bg-background border rounded px-2 py-1"
                />
                <input
                  type="text"
                  value={chapter.title}
                  onChange={(e) => handleUpdateChapter(index, "title", e.target.value)}
                  className="flex-1 text-xs bg-background border rounded px-2 py-1"
                  placeholder="Chapter title"
                />
                <button
                  type="button"
                  className={cn(
                    "text-xs px-2 py-1 rounded",
                    chapters.length <= 1
                      ? "opacity-40 cursor-not-allowed"
                      : "text-destructive hover:bg-destructive/10",
                  )}
                  onClick={() => handleRemoveChapter(index)}
                  disabled={chapters.length <= 1}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">
            {error}
          </p>
        )}

        <div className="space-y-2">
          <span className="text-xs font-medium">Preview</span>
          <pre className="text-xs bg-muted p-3 rounded whitespace-pre-wrap font-mono">
            {formattedText || "No chapters to preview"}
          </pre>
        </div>

        <button
          type="button"
          className={cn(
            "w-full py-2 px-3 text-xs font-medium rounded transition-colors",
            copied
              ? "bg-green-600 text-white"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
          onClick={handleCopy}
        >
          {copied ? "Copied!" : "Copy to Clipboard"}
        </button>
      </div>
    </div>
  );
}
