import type { ExportConfig } from "./export-config";

export interface ExportState {
	projectId: string;
	config: ExportConfig;
	completedFrames: number;
	totalFrames: number;
	timestamp: number;
}

const EXPORT_STATE_KEY = "opencut-export-state";

export class ResumeManager {
	private projectId: string;

	constructor(projectId: string) {
		this.projectId = projectId;
	}

	async saveState(state: ExportState): Promise<void> {
		try {
			localStorage.setItem(
				`${EXPORT_STATE_KEY}:${this.projectId}`,
				JSON.stringify(state),
			);
		} catch (e) {
			console.warn("[ResumeManager] Failed to save export state:", e);
		}
	}

	async loadState(): Promise<ExportState | null> {
		try {
			const raw = localStorage.getItem(`${EXPORT_STATE_KEY}:${this.projectId}`);
			if (!raw) return null;

			const state = JSON.parse(raw) as ExportState;

			// Clear stale state older than 24 hours
			if (Date.now() - state.timestamp > 24 * 60 * 60 * 1000) {
				await this.clearState();
				return null;
			}

			return state;
		} catch {
			return null;
		}
	}

	async clearState(): Promise<void> {
		try {
			localStorage.removeItem(`${EXPORT_STATE_KEY}:${this.projectId}`);
		} catch {
			// Ignore
		}
	}

	hasResumeState(): Promise<boolean> {
		return this.loadState().then(s => s !== null);
	}
}
