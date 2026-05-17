/**
 * Browser-only wrapper for opencut-wasm functions.
 * Prevents WASM loading during Next.js server-side build phase.
 */

let wasmModule: typeof import("opencut-wasm") | null = null;

async function getWasm(): Promise<typeof import("opencut-wasm")> {
	if (!wasmModule) {
		wasmModule = await import("opencut-wasm");
	}
	return wasmModule;
}

export async function formatTimecodeAsync(
	args: Parameters<typeof import("opencut-wasm").formatTimecode>[0],
): Promise<ReturnType<typeof import("opencut-wasm").formatTimecode>> {
	const { formatTimecode } = await getWasm();
	return formatTimecode(args);
}

export async function mediaTimeToSecondsAsync(
	args: Parameters<typeof import("opencut-wasm").mediaTimeToSeconds>[0],
): Promise<ReturnType<typeof import("opencut-wasm").mediaTimeToSeconds>> {
	const { mediaTimeToSeconds } = await getWasm();
	return mediaTimeToSeconds(args);
}

// Re-export types only (no runtime WASM dependency)
export type { FrameRate } from "opencut-wasm";
