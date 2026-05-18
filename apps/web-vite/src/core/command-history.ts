export interface CommandHistoryEntry {
	id: string;
	commandName: string;
	timestamp: number;
	serialized: string;
	undoable: boolean;
	redone: boolean;
}

export interface SerializableCommand {
	type: string;
	version: number;
	payload: Record<string, unknown>;
	metadata: {
		timestamp: number;
		userId?: string;
		sessionId: string;
	};
}

export interface HistoryState {
	entries: CommandHistoryEntry[];
	currentIndex: number;
	maxEntries: number;
	persistenceKey?: string;
}

export class CommandHistoryManager {
	private history: CommandHistoryEntry[] = [];
	private currentIndex = -1;
	private maxEntries = 100;
	private persistenceKey: string | null = null;

	constructor(options: { maxEntries?: number; persistenceKey?: string } = {}) {
		this.maxEntries = options.maxEntries ?? 100;
		this.persistenceKey = options.persistenceKey ?? null;

		if (this.persistenceKey) {
			this.loadFromStorage();
		}
	}

	push(entry: CommandHistoryEntry): void {
		this.history = this.history.slice(0, this.currentIndex + 1);

		if (this.history.length >= this.maxEntries) {
			this.history.shift();
		} else {
			this.currentIndex++;
		}

		this.history.push(entry);

		if (this.persistenceKey) {
			this.saveToStorage();
		}
	}

	undo(): CommandHistoryEntry | null {
		if (this.currentIndex < 0) return null;

		const entry = this.history[this.currentIndex];
		this.currentIndex--;
		return entry;
	}

	redo(): CommandHistoryEntry | null {
		if (this.currentIndex >= this.history.length - 1) return null;

		this.currentIndex++;
		return this.history[this.currentIndex];
	}

	canUndo(): boolean {
		return this.currentIndex >= 0;
	}

	canRedo(): boolean {
		return this.currentIndex < this.history.length - 1;
	}

	getHistory(): CommandHistoryEntry[] {
		return [...this.history];
	}

	getCurrentIndex(): number {
		return this.currentIndex;
	}

	jumpToIndex(index: number): void {
		if (index >= 0 && index < this.history.length) {
			this.currentIndex = index;
		}
	}

	selectiveUndo(entryId: string): boolean {
		const index = this.history.findIndex(e => e.id === entryId);
		if (index === -1 || !this.history[index].undoable) return false;

		this.history.splice(index, 1);
		if (this.currentIndex >= this.history.length) {
			this.currentIndex = this.history.length - 1;
		}
		return true;
	}

	serializeCommand(command: SerializableCommand): string {
		return JSON.stringify(command);
	}

	deserializeCommand(json: string): SerializableCommand {
		const parsed = JSON.parse(json) as SerializableCommand;
		if (!parsed.type || !parsed.version || !parsed.payload) {
			throw new Error("Invalid serialized command");
		}
		return parsed;
	}

	clear(): void {
		this.history = [];
		this.currentIndex = -1;
		if (this.persistenceKey) {
			localStorage.removeItem(this.persistenceKey);
		}
	}

	private saveToStorage(): void {
		if (!this.persistenceKey) return;

		try {
			const data = JSON.stringify({
				entries: this.history,
				currentIndex: this.currentIndex,
			});
			localStorage.setItem(this.persistenceKey, data);
		} catch {
			// Storage full, ignore
		}
	}

	private loadFromStorage(): void {
		if (!this.persistenceKey) return;

		try {
			const data = localStorage.getItem(this.persistenceKey);
			if (data) {
				const parsed = JSON.parse(data);
				this.history = parsed.entries ?? [];
				this.currentIndex = parsed.currentIndex ?? -1;
			}
		} catch {
			// Corrupted data, ignore
		}
	}
}

export const commandHistoryManager = new CommandHistoryManager({
	persistenceKey: "opencut-command-history",
});
