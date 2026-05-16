export interface EditOperation {
	id: string;
	type: "delete" | "trim" | "split";
	timeRange: { start: number; end: number };
	affectedWordIndices: number[];
	affectedClipIds: string[];
	deletedText: string;
	preview: EditPreview;
}

export interface EditPreview {
	deletedText: string;
	timeRange: { start: number; end: number };
	durationRemoved: number;
	affectedClips: { clipId: string; clipName: string; action: string }[];
}

export interface EditSuggestion {
	id: string;
	description: string;
	timeRange: { start: number; end: number };
	confidence: number;
	rawResponse: string;
}

export interface TextEditRange {
	start: number;
	end: number;
	text: string;
}

export interface DiffResult {
	deletedWordIndices: number[];
	deletedRanges: TextEditRange[];
}
