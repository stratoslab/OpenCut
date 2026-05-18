import { useState, useCallback } from "react";
import { useEditor } from "@/editor/use-editor";
import type { WordTranscript } from "@/transcription/types";
import { FillerDetector } from "@/smart-cut/filler-detector";
import { SilenceDetector } from "@/smart-cut/silence-detector";
import { RegionMerger } from "@/smart-cut/region-merger";
import { executeSmartCut } from "@/smart-cut/smart-cut-executor";
import type { TimeRange } from "@/smart-cut/region-merger";
import { cn } from "@/utils/ui";

const SENSITIVITY_PRESETS = {
	low: { threshold: 0.005, minDuration: 0.5 },
	medium: { threshold: 0.01, minDuration: 0.3 },
	high: { threshold: 0.02, minDuration: 0.15 },
};

type Sensitivity = "low" | "medium" | "high";

export function SmartCutBar({ transcript }: { transcript?: WordTranscript }) {
	const editor = useEditor();
	const [sensitivity, setSensitivity] = useState<Sensitivity>("medium");
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [fillerRegions, setFillerRegions] = useState<TimeRange[]>([]);
	const [silenceRegions, setSilenceRegions] = useState<TimeRange[]>([]);
	const [mergedRegions, setMergedRegions] = useState<TimeRange[]>([]);
	const [hasAnalyzed, setHasAnalyzed] = useState(false);

	const handleAnalyze = useCallback(async () => {
		setIsAnalyzing(true);
		try {
			const scene = editor.scenes.getActiveScene();
			const mainElement = scene.tracks.main.elements[0];
			if (!mainElement?.mediaId) return;

			const mediaAsset = editor.media.getAssets().find((m) => m.id === mainElement.mediaId);
			if (!mediaAsset) return;

			const audioCtx = new AudioContext();
			const arrayBuffer = await mediaAsset.file.arrayBuffer();
			const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
			const audioData = audioBuffer.getChannelData(0);

			const fillerDetector = new FillerDetector();
			const silenceDetector = new SilenceDetector();
			const regionMerger = new RegionMerger();

			const fillers = transcript
				? fillerDetector.detect(transcript.words)
				: [];

			const preset = SENSITIVITY_PRESETS[sensitivity];
			const silences = await silenceDetector.detect(audioData, preset);

			const allRegions = [...fillers, ...silences];
			const merged = regionMerger.merge(allRegions);

			setFillerRegions(fillers);
			setSilenceRegions(silences);
			setMergedRegions(merged);
			setHasAnalyzed(true);
		} finally {
			setIsAnalyzing(false);
		}
	}, [editor, transcript, sensitivity]);

	const handleRemoveAll = useCallback(async () => {
		if (mergedRegions.length === 0) return;
		await executeSmartCut({ editor, regions: mergedRegions });
		setHasAnalyzed(false);
		setFillerRegions([]);
		setSilenceRegions([]);
		setMergedRegions([]);
	}, [editor, mergedRegions]);

	const totalDuration = mergedRegions.reduce((sum, r) => sum + (r.end - r.start), 0);
	const timelineDuration = editor.timeline.getTotalDuration();
	const barWidth = timelineDuration > 0 ? (totalDuration / timelineDuration) * 100 : 0;

	if (!hasAnalyzed && !isAnalyzing) {
		return (
			<div className="p-3 space-y-3">
				<div className="flex items-center justify-between">
					<h3 className="text-xs font-medium">Smart Cut</h3>
					<select
						value={sensitivity}
						onChange={(e) => setSensitivity(e.target.value as Sensitivity)}
						className="text-xs bg-background border rounded px-2 py-1"
					>
						<option value="low">Low sensitivity</option>
						<option value="medium">Medium sensitivity</option>
						<option value="high">High sensitivity</option>
					</select>
				</div>
				{!transcript && (
					<p className="text-[10px] text-muted-foreground">
						No transcript available — only silence will be detected
					</p>
				)}
				<button
					type="button"
					className="w-full py-2 px-3 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90"
					onClick={handleAnalyze}
					disabled={isAnalyzing}
				>
					Analyze
				</button>
			</div>
		);
	}

	if (isAnalyzing) {
		return (
			<div className="p-3 space-y-3">
				<div className="flex items-center gap-2">
					<div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
					<span className="text-xs">Analyzing audio...</span>
				</div>
			</div>
		);
	}

	return (
		<div className="p-3 space-y-3">
			<div className="flex items-center justify-between">
				<h3 className="text-xs font-medium">Smart Cut Results</h3>
				<span className="text-[10px] text-muted-foreground">
					~{totalDuration.toFixed(1)}s removable
				</span>
			</div>

			<div className="grid grid-cols-2 gap-2 text-[10px]">
				<div className="p-2 bg-muted/50 rounded">
					<span className="text-muted-foreground">Fillers:</span>{" "}
					<span className="font-medium">{fillerRegions.length}</span>
				</div>
				<div className="p-2 bg-muted/50 rounded">
					<span className="text-muted-foreground">Silences:</span>{" "}
					<span className="font-medium">{silenceRegions.length}</span>
				</div>
			</div>

			<div className="relative h-8 bg-muted/30 rounded overflow-hidden">
				{mergedRegions.map((region, i) => {
					const left = (region.start / timelineDuration) * 100;
					const width = ((region.end - region.start) / timelineDuration) * 100;
					return (
						<div
							key={i}
							className={cn(
								"absolute top-0 bottom-0",
								region.type === "filler"
									? "bg-amber-500/40"
									: "bg-blue-500/40",
							)}
							style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }}
							title={`${region.type}: ${region.start.toFixed(1)}s - ${region.end.toFixed(1)}s`}
						/>
					);
				})}
			</div>

			<div className="flex gap-2">
				<button
					type="button"
					className="flex-1 py-2 px-3 text-xs font-medium rounded bg-destructive text-destructive-foreground hover:bg-destructive/90"
					onClick={handleRemoveAll}
				>
					Remove All ({mergedRegions.length} regions)
				</button>
				<button
					type="button"
					className="py-2 px-3 text-xs font-medium rounded border hover:bg-muted"
					onClick={() => {
						setHasAnalyzed(false);
						setFillerRegions([]);
						setSilenceRegions([]);
						setMergedRegions([]);
					}}
				>
					Reset
				</button>
			</div>
		</div>
	);
}
