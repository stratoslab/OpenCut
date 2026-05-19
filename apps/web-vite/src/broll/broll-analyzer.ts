import type { WordTranscript } from "@/transcription/types";
import { cosineSimilarity as clipCosineSimilarity, useClipModelStore } from "@/ai/clip-store";

export interface BrollSuggestion {
	id: string;
	text: string;
	startTime: number;
	endTime: number;
	semanticQuery: string;
	confidence: number;
	thumbnailUrl?: string;
}

export interface SemanticEmbedding {
	query: string;
	vector: number[];
}

const VISUAL_CONCEPTS: Record<string, string[]> = {
	nature: ["tree", "forest", "mountain", "river", "ocean", "sky", "sun", "cloud", "flower", "garden"],
	technology: ["computer", "phone", "screen", "code", "software", "app", "internet", "digital", "data"],
	people: ["person", "people", "crowd", "team", "group", "family", "friend", "man", "woman", "child"],
	city: ["building", "street", "city", "urban", "traffic", "car", "road", "bridge", "architecture"],
	food: ["food", "cook", "kitchen", "restaurant", "meal", "dish", "eat", "recipe", "ingredient"],
	business: ["office", "meeting", "work", "business", "money", "finance", "presentation", "team"],
	sports: ["sport", "game", "run", "jump", "ball", "field", "court", "competition", "athlete"],
	music: ["music", "song", "instrument", "guitar", "piano", "concert", "band", "dance"],
	travel: ["travel", "trip", "vacation", "airport", "hotel", "beach", "map", "adventure", "explore"],
	education: ["learn", "study", "school", "book", "class", "teacher", "student", "lesson"],
};

const CONTEXTUAL_TRIGGERS = [
	{ pattern: /imagine|picture|visualize|see|look/i, query: "abstract concept visualization" },
	{ pattern: /for example|such as|like|instance/i, query: "illustrative example" },
	{ pattern: /show|demonstrate|illustrate|display/i, query: "demonstration" },
	{ pattern: /compare|versus|vs|difference/i, query: "comparison split screen" },
	{ pattern: /result|outcome|effect|impact/i, query: "result outcome" },
	{ pattern: /process|step|method|way/i, query: "process steps" },
	{ pattern: /growth|increase|rise|up/i, query: "growth upward trend" },
	{ pattern: /decline|decrease|fall|down/i, query: "decline downward trend" },
	{ pattern: /connection|link|network|relationship/i, query: "connection network" },
	{ pattern: /future|tomorrow|next|upcoming/i, query: "future technology" },
	{ pattern: /past|history|before|old/i, query: "history vintage" },
	{ pattern: /world|global|international|earth/i, query: "world globe global" },
];

function computeTextEmbedding(text: string): number[] {
	const words = text.toLowerCase().split(/\s+/);
	const vector = new Array(64).fill(0);

	for (const word of words) {
		const hash = simpleHash(word);
		for (let i = 0; i < 8; i++) {
			const idx = (hash + i * 7) % 64;
			vector[idx] += 1;
		}
	}

	const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
	return vector.map(v => v / magnitude);
}

function simpleHash(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash |= 0;
	}
	return Math.abs(hash);
}

function cosineSimilarity(a: number[], b: number[]): number {
	if (a.length !== b.length) return 0;
	let dotProduct = 0;
	let normA = 0;
	let normB = 0;

	for (let i = 0; i < a.length; i++) {
		dotProduct += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}

	return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

function extractSemanticQuery(
	context: string,
	wordWindow = 5,
): { query: string; confidence: number } {
	const lower = context.toLowerCase();

	for (const trigger of CONTEXTUAL_TRIGGERS) {
		if (trigger.pattern.test(lower)) {
			return { query: trigger.query, confidence: 0.8 };
		}
	}

	const words = context.split(/\s+/);
	const conceptMatches: Array<{ concept: string; score: number }> = [];

	for (const [concept, keywords] of Object.entries(VISUAL_CONCEPTS)) {
		let score = 0;
		for (const keyword of keywords) {
			if (lower.includes(keyword)) {
				score += 1;
			}
		}
		if (score > 0) {
			conceptMatches.push({ concept, score: score / keywords.length });
		}
	}

	if (conceptMatches.length > 0) {
		conceptMatches.sort((a, b) => b.score - a.score);
		const top = conceptMatches[0];
		return { query: top.concept, confidence: top.score };
	}

	const filtered = words.filter(w => w.length > 3 && !isStopWord(w));
	if (filtered.length >= 2) {
		return {
			query: filtered.slice(0, wordWindow).join(" "),
			confidence: 0.5,
		};
	}

	return { query: context, confidence: 0.3 };
}

function isStopWord(word: string): boolean {
	const stopWords = new Set([
		"the", "a", "an", "is", "are", "was", "were", "be", "been",
		"being", "have", "has", "had", "do", "does", "did", "will",
		"would", "could", "should", "may", "might", "shall", "can",
		"need", "dare", "ought", "used", "to", "of", "in", "for",
		"on", "with", "at", "by", "from", "as", "into", "through",
		"during", "before", "after", "above", "below", "between",
		"out", "off", "over", "under", "again", "further", "then",
		"once", "here", "there", "when", "where", "why", "how",
		"all", "both", "each", "few", "more", "most", "other",
		"some", "such", "no", "nor", "not", "only", "own", "same",
		"so", "than", "too", "very", "just", "because", "but", "and",
		"or", "if", "while", "that", "this", "these", "those", "it",
		"its", "they", "them", "their", "what", "which", "who",
	]);
	return stopWords.has(word.toLowerCase());
}

export class BrollAnalyzer {
	analyze(transcript: WordTranscript): BrollSuggestion[] {
		const suggestions: BrollSuggestion[] = [];
		const words = transcript.words;
		const windowSize = 8;

		for (let i = 0; i < words.length; i += 3) {
			const windowEnd = Math.min(i + windowSize, words.length);
			const windowWords = words.slice(i, windowEnd);
			if (windowWords.length < 3) continue;

			const context = windowWords.map(w => w.text).join(" ");
			const { query, confidence } = extractSemanticQuery(context);

			if (confidence < 0.3) continue;

			const startTime = windowWords[0].start;
			const endTime = windowWords[windowWords.length - 1].end;

			suggestions.push({
				id: `broll-${i}`,
				text: context,
				startTime,
				endTime,
				semanticQuery: query,
				confidence,
			});
		}

		return this.deduplicateSuggestions(suggestions);
	}

	async enrichWithThumbnails(
		suggestions: BrollSuggestion[],
		searchFn: (query: string) => Promise<string | undefined>,
	): Promise<BrollSuggestion[]> {
		const enriched = [...suggestions];

		for (let i = 0; i < enriched.length; i++) {
			const thumbnail = await searchFn(enriched[i].semanticQuery);
			if (thumbnail) {
				enriched[i].thumbnailUrl = thumbnail;
			}
			if (i % 3 === 0) {
				await new Promise(r => setTimeout(r, 0));
			}
		}

		return enriched;
	}

	private deduplicateSuggestions(suggestions: BrollSuggestion[]): BrollSuggestion[] {
		if (suggestions.length === 0) return [];

		const deduplicated: BrollSuggestion[] = [suggestions[0]];

		for (let i = 1; i < suggestions.length; i++) {
			const current = suggestions[i];
			const last = deduplicated[deduplicated.length - 1];

			const timeGap = current.startTime - last.endTime;
			const similarity = this.computeQuerySimilarity(current.semanticQuery, last.semanticQuery);

			if (timeGap < 2 && similarity > 0.7) {
				if (current.confidence > last.confidence) {
					deduplicated[deduplicated.length - 1] = {
						...current,
						startTime: last.startTime,
						endTime: current.endTime,
					};
				} else {
					deduplicated[deduplicated.length - 1] = {
						...last,
						endTime: current.endTime,
					};
				}
			} else {
				deduplicated.push(current);
			}
		}

		return deduplicated;
	}

	private computeQuerySimilarity(a: string, b: string): number {
		const embedA = computeTextEmbedding(a);
		const embedB = computeTextEmbedding(b);
		return cosineSimilarity(embedA, embedB);
	}

	/**
	 * Scores how well a video frame matches a b-roll semantic query using CLIP.
	 * Returns a relevance score in [0, 1]. Returns 0.5 as a neutral fallback
	 * when CLIP is not ready.
	 */
	async scoreFrameRelevance(frame: ImageData, query: string): Promise<number> {
		const store = useClipModelStore.getState();
		if (store.stage !== "ready") return 0.5;

		try {
			const [imgEmb, [textEmb]] = await Promise.all([
				store.embedImage(frame),
				store.embedTexts([query]),
			]);
			// Cosine similarity ∈ [-1, 1] → mapped to [0, 1]
			const sim = clipCosineSimilarity(imgEmb, textEmb);
			return (sim + 1) / 2;
		} catch {
			return 0.5;
		}
	}

	/**
	 * Enriches b-roll suggestions with visual confidence scores from CLIP.
	 * For each suggestion, fetches the frame at startTime and averages the
	 * keyword-derived confidence with the CLIP visual relevance score.
	 */
	async enrichWithVisualConfidence(
		suggestions: BrollSuggestion[],
		getFrame: (startTime: number) => Promise<ImageData | null>,
	): Promise<BrollSuggestion[]> {
		const enriched = suggestions.map(s => ({ ...s }));

		for (const s of enriched) {
			let frame: ImageData | null = null;
			try {
				frame = await getFrame(s.startTime);
			} catch {
				// getFrame rejected — leave confidence unchanged
			}
			if (frame === null) continue;

			const visual = await this.scoreFrameRelevance(frame, s.semanticQuery);
			s.confidence = (s.confidence + visual) / 2;
		}

		return enriched;
	}
}

export class PexelsClient {
	private apiKey: string;

	constructor(apiKey: string) {
		this.apiKey = apiKey;
	}

	async search(query: string, perPage = 5): Promise<Array<{ id: string; url: string; thumbnail: string }>> {
		try {
			const response = await fetch(
				`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}`,
				{ headers: { Authorization: this.apiKey } },
			);
			const data = await response.json();
			return data.videos.map((v: Record<string, unknown>) => ({
				id: String(v.id),
				url: String(v.url),
				thumbnail: String((v.image as Record<string, unknown>)?.medium || ""),
			}));
		} catch {
			return [];
		}
	}
}
