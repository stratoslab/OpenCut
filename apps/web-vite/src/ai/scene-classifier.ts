import type { SceneChange } from "@/video/scene-detector";
import type { WordTranscript } from "@/transcription/types";
import { useClipModelStore } from "@/ai/clip-store";

export interface ClassifiedScene {
	id: string;
	startTime: number;
	endTime: number;
	type: "cut" | "dissolve";
	category: SceneCategory;
	confidence: number;
	transcriptSnippet: string;
	isHighlight: boolean;
	highlightReason?: string;
}

export type SceneCategory =
	| "talking-head"
	| "b-roll"
	| "action"
	| "transition"
	| "silent"
	| "music"
	| "intro"
	| "outro"
	| "unknown";

export interface HighlightReel {
	id: string;
	title: string;
	scenes: ClassifiedScene[];
	totalDuration: number;
}

const ACTION_VERBS = [
	"run", "jump", "walk", "move", "go", "drive", "fly", "swim",
	"build", "create", "make", "destroy", "break", "fix", "open",
	"close", "push", "pull", "throw", "catch", "hit", "kick",
	"show", "demonstrate", "explain", "teach", "learn", "discover",
];

const EMOTION_WORDS = [
	"amazing", "incredible", "wow", "fantastic", "terrible",
	"horrible", "beautiful", "stunning", "shocking", "surprising",
	"exciting", "funny", "hilarious", "sad", "touching", "inspiring",
	"important", "critical", "key", "main", "big", "huge",
];

const INTRO_PATTERNS = [
	/^hi\s/i, /^hello\s/i, /^welcome/i, /^hey\s/i,
	/^today\s/i, /^in\s+this\s/i, /^let\s/i, /^so\s/i,
];

const OUTRO_PATTERNS = [
	/thanks?\s/i, /thank\s+you/i, /subscribe/i, /like\s+and/i,
	/see\s+you/i, /goodbye/i, /that'?s\s+all/i, /wrap\s+up/i,
	/to\s+sum\s+up/i, /in\s+conclusion/i,
];

export class SceneClassifier {
	classify(
		scenes: SceneChange[],
		transcript?: WordTranscript,
		videoDuration?: number,
	): ClassifiedScene[] {
		if (scenes.length === 0) return [];

		const classified: ClassifiedScene[] = [];
		const words = transcript?.words ?? [];

		for (let i = 0; i < scenes.length; i++) {
			const scene = scenes[i];
			const nextScene = scenes[i + 1];
			const startTime = scene.timestamp;
			const endTime = nextScene?.timestamp ?? (videoDuration ?? startTime + 5);

			const snippet = this.getTranscriptSnippet(words, startTime, endTime);
			const category = this.categorizeScene(scene, snippet, i, scenes.length, videoDuration);
			const { isHighlight, reason } = this.isHighlightCandidate(scene, snippet, category);

			classified.push({
				id: `scene-${i}`,
				startTime,
				endTime,
				type: scene.type,
				category,
				confidence: this.computeConfidence(scene, snippet, category),
				transcriptSnippet: snippet,
				isHighlight,
				highlightReason: reason,
			});
		}

		return classified;
	}

	generateHighlightReel(
		classified: ClassifiedScene[],
		maxDuration?: number,
	): HighlightReel {
		const highlights = classified.filter(s => s.isHighlight);

		if (maxDuration) {
			const selected: ClassifiedScene[] = [];
			let total = 0;

			const sorted = [...highlights].sort((a, b) => b.confidence - a.confidence);

			for (const scene of sorted) {
				const duration = scene.endTime - scene.startTime;
				if (total + duration <= maxDuration) {
					selected.push(scene);
					total += duration;
				}
			}

			selected.sort((a, b) => a.startTime - b.startTime);

			return {
				id: crypto.randomUUID(),
				title: "Auto Highlights",
				scenes: selected,
				totalDuration: selected.reduce((sum, s) => sum + (s.endTime - s.startTime), 0),
			};
		}

		return {
			id: crypto.randomUUID(),
			title: "Auto Highlights",
			scenes: highlights.sort((a, b) => a.startTime - b.startTime),
			totalDuration: highlights.reduce((sum, s) => sum + (s.endTime - s.startTime), 0),
		};
	}

	private getTranscriptSnippet(
		words: WordTranscript["words"],
		start: number,
		end: number,
	): string {
		const relevant = words.filter((w: { start: number; end: number }) => w.start >= start && w.end <= end);
		if (relevant.length === 0) return "";
		return relevant.map((w: { text: string }) => w.text).join(" ");
	}

	private categorizeScene(
		scene: SceneChange,
		snippet: string,
		index: number,
		total: number,
		_duration?: number,
	): SceneCategory {
		const lower = snippet.toLowerCase();
		const isStart = index < 2;
		const isEnd = index > total - 3;

		if (isStart && INTRO_PATTERNS.some(p => p.test(lower))) return "intro";
		if (isEnd && OUTRO_PATTERNS.some(p => p.test(lower))) return "outro";

		if (snippet.length === 0) {
			return scene.chiSquaredDistance > 1.0 ? "b-roll" : "silent";
		}

		const hasAction = ACTION_VERBS.some(v => lower.includes(v));
		if (hasAction) return "action";

		const hasEmotion = EMOTION_WORDS.some(e => lower.includes(e));
		if (hasEmotion) return "talking-head";

		if (scene.type === "dissolve") return "transition";

		const wordCount = snippet.split(/\s+/).length;
		if (wordCount > 10) return "talking-head";
		if (wordCount > 0) return "b-roll";

		return "unknown";
	}

	private isHighlightCandidate(
		scene: SceneChange,
		snippet: string,
		category: SceneCategory,
	): { isHighlight: boolean; reason?: string } {
		const lower = snippet.toLowerCase();

		if (EMOTION_WORDS.some(e => lower.includes(e))) {
			return { isHighlight: true, reason: "Emotional content detected" };
		}

		if (category === "action") {
			return { isHighlight: true, reason: "Action sequence" };
		}

		if (scene.chiSquaredDistance > 2.0) {
			return { isHighlight: true, reason: "Major scene transition" };
		}

		if (category === "intro" || category === "outro") {
			return { isHighlight: false };
		}

		const wordCount = snippet.split(/\s+/).filter(Boolean).length;
		if (wordCount >= 5 && wordCount <= 30) {
			return { isHighlight: true, reason: "Concise speaking segment" };
		}

		return { isHighlight: false };
	}

	private computeConfidence(
		scene: SceneChange,
		snippet: string,
		category: SceneCategory,
	): number {
		let confidence = 0.5;

		if (snippet.length > 0) confidence += 0.2;
		if (scene.chiSquaredDistance > 1.0) confidence += 0.15;
		if (category !== "unknown") confidence += 0.15;

		return Math.min(confidence, 1.0);
	}

	/**
	 * Classifies scenes using CLIP visual embeddings when available,
	 * falling back to keyword-based classification for scenes without frames
	 * or when CLIP is not ready.
	 */
	async classifyWithVision(
		scenes: SceneChange[],
		frames: Map<string, ImageData>,
		transcript?: WordTranscript,
		videoDuration?: number,
	): Promise<ClassifiedScene[]> {
		const store = useClipModelStore.getState();

		// Fall back to keyword classification if CLIP not ready
		if (store.stage !== "ready") {
			return this.classify(scenes, transcript, videoDuration);
		}

		if (scenes.length === 0) return [];

		const classified: ClassifiedScene[] = [];
		const words = transcript?.words ?? [];

		for (let i = 0; i < scenes.length; i++) {
			const scene = scenes[i];
			const nextScene = scenes[i + 1];
			const startTime = scene.timestamp;
			const endTime = nextScene?.timestamp ?? (videoDuration ?? startTime + 5);
			const snippet = this.getTranscriptSnippet(words, startTime, endTime);
			const sceneId = `scene-${i}`;

			let category: SceneCategory;
			let confidence: number;

			const frame = frames.get(sceneId);
			if (frame) {
				try {
					const result = await store.classifyFrame(frame);
					category = result.category;
					confidence = result.confidence;
				} catch {
					// CLIP failed for this frame — fall back to keyword
					category = this.categorizeScene(scene, snippet, i, scenes.length, videoDuration);
					confidence = this.computeConfidence(scene, snippet, category);
				}
			} else {
				category = this.categorizeScene(scene, snippet, i, scenes.length, videoDuration);
				confidence = this.computeConfidence(scene, snippet, category);
			}

			const { isHighlight, reason } = this.isHighlightCandidate(scene, snippet, category);

			classified.push({
				id: sceneId,
				startTime,
				endTime,
				type: scene.type,
				category,
				confidence,
				transcriptSnippet: snippet,
				isHighlight,
				highlightReason: reason,
			});
		}

		return classified;
	}
}
