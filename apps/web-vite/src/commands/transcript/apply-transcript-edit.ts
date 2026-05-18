import { Command, type CommandResult } from "@/commands/base-command";
import { EditorCore } from "@/core";
import type {
	SceneTracks,
	TScene,
	TimelineElement,
	VideoTrack,
} from "@/timeline";
import type { WordTranscript } from "@/transcription/types";
import { generateUUID } from "@/utils/id";
import { mediaTimeFromSeconds, type MediaTime } from "@/wasm";
import type { TranscriptEditPlan } from "@/transcript-editor/planner";

interface ApplyTranscriptEditCommandArgs {
	plan: TranscriptEditPlan;
	ripple: boolean;
}

export class ApplyTranscriptEditCommand extends Command {
	private beforeScenes: TScene[] | null = null;
	private afterScenes: TScene[] | null = null;
	private editedSceneId: string | null = null;

	constructor(private readonly args: ApplyTranscriptEditCommandArgs) {
		super();
	}

	execute(): CommandResult | undefined {
		const editor = EditorCore.getInstance();
		const activeScene = editor.scenes.getActiveScene();
		const scenes = editor.scenes.getScenes();
		this.beforeScenes = scenes;
		this.editedSceneId = activeScene.id;

		const nextTracks = applyPlanToTracks({
			tracks: activeScene.tracks,
			plan: this.args.plan,
			ripple: this.args.ripple,
		});
		const nextTranscript = activeScene.transcript
			? applyPlanToTranscript({
					transcript: activeScene.transcript,
					plan: this.args.plan,
					ripple: this.args.ripple,
				})
			: undefined;

		const nextScene: TScene = {
			...activeScene,
			tracks: nextTracks,
			transcript: nextTranscript,
			updatedAt: new Date(),
		};
		const nextScenes = scenes.map((scene) =>
			scene.id === activeScene.id ? nextScene : scene,
		);

		this.afterScenes = nextScenes;
		editor.scenes.setScenes({
			scenes: nextScenes,
			activeSceneId: activeScene.id,
		});
		return undefined;
	}

	undo(): void {
		if (!this.beforeScenes) return;
		const editor = EditorCore.getInstance();
		editor.scenes.setScenes({ scenes: this.beforeScenes });
	}

	redo(): CommandResult | undefined {
		if (!this.afterScenes) {
			return this.execute();
		}
		const editor = EditorCore.getInstance();
		editor.scenes.setScenes({
			scenes: this.afterScenes,
			activeSceneId: this.editedSceneId ?? undefined,
		});
		return undefined;
	}
}

function applyPlanToTracks({
	tracks,
	plan,
	ripple,
}: {
	tracks: SceneTracks;
	plan: TranscriptEditPlan;
	ripple: boolean;
}): SceneTracks {
	const deletionRanges = plan.ranges
		.map((range) => ({
			start: mediaTimeFromSeconds({ seconds: range.timeRange.start }),
			end: mediaTimeFromSeconds({ seconds: range.timeRange.end }),
		}))
		.sort((a, b) => a.start - b.start);

	const nextMain: VideoTrack = {
		...tracks.main,
		elements: tracks.main.elements.flatMap((element) =>
			applyRangesToElement({
				element,
				deletionRanges,
				ripple,
			}),
		),
	};

	return {
		...tracks,
		main: nextMain,
	};
}

function applyRangesToElement({
	element,
	deletionRanges,
	ripple,
}: {
	element: VideoTrack["elements"][number];
	deletionRanges: Array<{ start: MediaTime; end: MediaTime }>;
	ripple: boolean;
}): VideoTrack["elements"] {
	const elementStart = element.startTime;
	const elementEnd = (element.startTime + element.duration) as MediaTime;
	let kept = [{ start: elementStart, end: elementEnd }];

	for (const range of deletionRanges) {
		const nextKept: typeof kept = [];
		for (const segment of kept) {
			if (range.end <= segment.start || range.start >= segment.end) {
				nextKept.push(segment);
				continue;
			}
			if (range.start > segment.start) {
				nextKept.push({ start: segment.start, end: range.start });
			}
			if (range.end < segment.end) {
				nextKept.push({ start: range.end, end: segment.end });
			}
		}
		kept = nextKept;
	}

	return kept.map((segment, index) => {
		const segmentDuration = (segment.end - segment.start) as MediaTime;
		const startShift = removedDurationBefore({
			ranges: deletionRanges,
			time: segment.start,
		});
		const startTime = ripple
			? ((segment.start - startShift) as MediaTime)
			: segment.start;
		const trimStart = (element.trimStart +
			(segment.start - elementStart)) as MediaTime;
		const trimEnd = (element.trimEnd + (elementEnd - segment.end)) as MediaTime;

		return {
			...element,
			id: index === 0 ? element.id : generateUUID(),
			startTime,
			duration: segmentDuration,
			trimStart,
			trimEnd,
		} satisfies TimelineElement;
	}) as VideoTrack["elements"];
}

function removedDurationBefore({
	ranges,
	time,
}: {
	ranges: Array<{ start: MediaTime; end: MediaTime }>;
	time: MediaTime;
}): MediaTime {
	let removed = 0;
	for (const range of ranges) {
		if (range.end <= time) {
			removed += range.end - range.start;
		} else if (range.start < time) {
			removed += time - range.start;
		}
	}
	return removed as MediaTime;
}

function applyPlanToTranscript({
	transcript,
	plan,
	ripple,
}: {
	transcript: WordTranscript;
	plan: TranscriptEditPlan;
	ripple: boolean;
}): WordTranscript {
	const deleted = new Set(plan.ranges.flatMap((range) => range.wordIndices));
	const ranges = plan.ranges
		.map((range) => range.timeRange)
		.sort((a, b) => a.start - b.start);

	const words = transcript.words
		.filter((word) => !deleted.has(word.wordIndex))
		.map((word, index) => {
			const shift = ripple
				? removedSecondsBefore({ ranges, time: word.start })
				: 0;
			return {
				...word,
				start: Math.max(0, word.start - shift),
				end: Math.max(0, word.end - shift),
				wordIndex: index,
			};
		});

	return {
		...transcript,
		words,
		fullText: words.map((word) => word.text).join(" "),
		videoDuration: Math.max(
			0,
			transcript.videoDuration - (ripple ? plan.cutPlan.durationRemoved : 0),
		),
	};
}

function removedSecondsBefore({
	ranges,
	time,
}: {
	ranges: Array<{ start: number; end: number }>;
	time: number;
}): number {
	return ranges.reduce((total, range) => {
		if (range.end <= time) {
			return total + range.end - range.start;
		}
		if (range.start < time) {
			return total + time - range.start;
		}
		return total;
	}, 0);
}
