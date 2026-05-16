import type { EditOperation } from "./types";
import type { TimelineClip } from "./timeline-cutter";

export interface EditHistoryEntry {
	id: string;
	timestamp: number;
	originalText: string;
	editedText: string;
	operations: EditOperation[];
	timelineSnapshot: TimelineClip[];
}

export class EditUndoRedoStack {
	private undoStack: EditHistoryEntry[] = [];
	private redoStack: EditHistoryEntry[] = [];
	private maxDepth: number;

	constructor(maxDepth: number = 50) {
		this.maxDepth = maxDepth;
	}

	push(entry: EditHistoryEntry): void {
		this.undoStack.push(entry);
		this.redoStack = [];

		if (this.undoStack.length > this.maxDepth) {
			this.undoStack = this.undoStack.slice(-this.maxDepth);
		}
	}

	undo(): EditHistoryEntry | null {
		if (this.undoStack.length === 0) return null;

		const entry = this.undoStack.pop()!;
		this.redoStack.push(entry);

		return entry;
	}

	redo(): EditHistoryEntry | null {
		if (this.redoStack.length === 0) return null;

		const entry = this.redoStack.pop()!;
		this.undoStack.push(entry);

		return entry;
	}

	canUndo(): boolean {
		return this.undoStack.length > 0;
	}

	canRedo(): boolean {
		return this.redoStack.length > 0;
	}

	clear(): void {
		this.undoStack = [];
		this.redoStack = [];
	}

	getUndoDepth(): number {
		return this.undoStack.length;
	}

	getRedoDepth(): number {
		return this.redoStack.length;
	}

	setMaxDepth(maxDepth: number): void {
		this.maxDepth = maxDepth;
		if (this.undoStack.length > this.maxDepth) {
			this.undoStack = this.undoStack.slice(-this.maxDepth);
		}
	}
}
