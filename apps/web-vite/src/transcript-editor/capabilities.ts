export interface TranscriptCapabilities {
	wasmReady: boolean;
	transcriptionWorkerAvailable: boolean;
	webGpuAvailable: boolean;
	localModelStorageAvailable: boolean;
	manualEditingAvailable: boolean;
	unavailableReason?: string;
}

export interface AICapabilities {
	available: boolean;
	provider: "local-gemma" | "external-opt-in" | "none";
	requiresConsent: boolean;
	unavailableReason?: string;
}

export function getTranscriptCapabilities(): TranscriptCapabilities {
	const workerAvailable = typeof Worker !== "undefined";
	const webGpuAvailable =
		typeof navigator !== "undefined" && "gpu" in navigator;
	const storageAvailable =
		typeof navigator !== "undefined" && "storage" in navigator;

	return {
		wasmReady: true,
		transcriptionWorkerAvailable: workerAvailable,
		webGpuAvailable,
		localModelStorageAvailable: storageAvailable,
		manualEditingAvailable: true,
		unavailableReason: workerAvailable
			? undefined
			: "This browser does not support transcription workers.",
	};
}

export function getAICapabilities(): AICapabilities {
	return {
		available: false,
		provider: "none",
		requiresConsent: false,
		unavailableReason:
			"Local Gemma chat is not connected yet. Manual transcript editing stays local and available.",
	};
}

export function sanitizeTranscriptDiagnostic(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	return "Transcript operation failed";
}
