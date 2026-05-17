import type { WordSegment, WordTranscript } from "@/transcription/types";
import type { TimelineClip } from "@/text-edit-engine/timeline-cutter";
import { TextEditEngine } from "@/text-edit-engine";
import { EditUndoRedoStack } from "@/text-edit-engine/undo-redo-stack";

export interface TranscriptEditorState {
	transcript: WordTranscript | null;
	isLoading: boolean;
	error: string | null;
	currentText: string;
	originalText: string;
	clips: TimelineClip[];
	hoveredWord: WordSegment | null;
	highlightedTimeRange: { start: number; end: number } | null;
}

export interface TranscriptEditorActions {
	setTranscript: (transcript: WordTranscript) => void;
	setLoading: (loading: boolean) => void;
	setError: (error: string | null) => void;
	applyTextEdit: (
		deletedRanges: { start: number; end: number; text: string }[],
	) => void;
	undo: () => void;
	redo: () => void;
	setHoveredWord: (word: WordSegment | null) => void;
	setHighlightedTimeRange: (
		range: { start: number; end: number } | null,
	) => void;
	getWordAtTime: (time: number) => WordSegment | null;
	canUndo: () => boolean;
	canRedo: () => boolean;
}

export class TranscriptEditorController {
	private state: TranscriptEditorState;
	private engine: TextEditEngine | null = null;
	private undoStack: EditUndoRedoStack;
	private listeners: Set<() => void>;

	constructor() {
		this.state = {
			transcript: null,
			isLoading: false,
			error: null,
			currentText: "",
			originalText: "",
			clips: [],
			hoveredWord: null,
			highlightedTimeRange: null,
		};
		this.undoStack = new EditUndoRedoStack(50);
		this.listeners = new Set();
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notify(): void {
		for (const listener of this.listeners) {
			listener();
		}
	}

	getState(): TranscriptEditorState {
		return this.state;
	}

	setTranscript(transcript: WordTranscript): void {
		this.state = {
			...this.state,
			transcript,
			currentText: transcript.fullText,
			originalText: transcript.fullText,
		};
		this.engine = new TextEditEngine(transcript.words, this.state.clips);
		this.notify();
	}

	setLoading(loading: boolean): void {
		this.state = { ...this.state, isLoading: loading };
		this.notify();
	}

	setError(error: string | null): void {
		this.state = { ...this.state, error };
		this.notify();
	}

	applyTextEdit(
		deletedRanges: { start: number; end: number; text: string }[],
	): void {
		if (!this.engine || !this.state.transcript) return;

		const currentText = this.state.currentText;
		let newText = currentText;

		for (const range of deletedRanges) {
			newText = newText.replace(range.text, "");
		}

		const editResult = this.engine.applyTextEdit(currentText, newText);

		if (editResult.operations.length === 0) return;

		this.undoStack.push({
			id: `edit-${Date.now()}`,
			timestamp: Date.now(),
			originalText: currentText,
			editedText: newText,
			operations: editResult.operations,
			timelineSnapshot: [...this.state.clips],
		});

		const updatedClips = this.engine.applyRippleEdit(deletedRanges);

		this.state = {
			...this.state,
			currentText: newText,
			clips: updatedClips,
		};

		this.notify();
	}

	undo(): void {
		const entry = this.undoStack.undo();
		if (!entry) return;

		this.state = {
			...this.state,
			currentText: entry.originalText,
			clips: entry.timelineSnapshot,
		};

		this.notify();
	}

	redo(): void {
		const entry = this.undoStack.redo();
		if (!entry) return;

		this.state = {
			...this.state,
			currentText: entry.editedText,
			clips: entry.timelineSnapshot,
		};

		this.notify();
	}

	setHoveredWord(word: WordSegment | null): void {
		this.state = {
			...this.state,
			hoveredWord: word,
			highlightedTimeRange: word
				? { start: word.start, end: word.end }
				: null,
		};
		this.notify();
	}

	setHighlightedTimeRange(
		range: { start: number; end: number } | null,
	): void {
		this.state = { ...this.state, highlightedTimeRange: range };
		this.notify();
	}

	getWordAtTime(time: number): WordSegment | null {
		if (!this.engine) return null;
		return this.engine.getWordAtTime(time);
	}

	canUndo(): boolean {
		return this.undoStack.canUndo();
	}

	canRedo(): boolean {
		return this.undoStack.canRedo();
	}

	setClips(clips: TimelineClip[]): void {
		this.state = { ...this.state, clips };
		if (this.state.transcript) {
			this.engine = new TextEditEngine(this.state.transcript.words, clips);
		}
		this.notify();
	}
}

export const transcriptEditorController = new TranscriptEditorController();
