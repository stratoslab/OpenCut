/**
 * OpenCut SDK Architecture — Package Extraction Plan
 *
 * Current: Monolithic `apps/web-vite/` with shared Rust crates
 * Target: 6 npm packages with clear boundaries
 *
 * @opencut/timeline     — Timeline model, tracks, operations, undo/redo
 * @opencut/renderer     — GPU rendering engine (Rust/WASM wrapper)
 * @opencut/effects      — Effect definitions + WGSL shaders
 * @opencut/ai           — Transcription, LLM, agent execution, scene classification
 * @opencut/audio        — Audio engine, EQ, effects, beat detection
 * @opencut/studio       — Full UI (current web-vite app, depends on all above)
 */

export interface SDKPackage {
	name: string;
	description: string;
	entry: string;
	dependencies: string[];
	externalDependencies: string[];
}

export const SDK_PACKAGES: SDKPackage[] = [
	{
		name: "@opencut/timeline",
		description: "Timeline model, tracks, elements, operations, undo/redo, ripple edits",
		entry: "packages/timeline/src/index.ts",
		dependencies: [],
		externalDependencies: [],
	},
	{
		name: "@opencut/renderer",
		description: "GPU rendering engine — Rust/WASM compositor, WebGPU pipeline, scene graph",
		entry: "packages/renderer/src/index.ts",
		dependencies: ["@opencut/timeline"],
		externalDependencies: ["wgpu", "wasm-bindgen"],
	},
	{
		name: "@opencut/effects",
		description: "Effect definitions, WGSL shaders, registry, parameter system",
		entry: "packages/effects/src/index.ts",
		dependencies: ["@opencut/renderer"],
		externalDependencies: [],
	},
	{
		name: "@opencut/ai",
		description: "Transcription (Whisper), LLM (Gemma), agent execution, scene classification, segmentation",
		entry: "packages/ai/src/index.ts",
		dependencies: ["@opencut/timeline"],
		externalDependencies: ["@huggingface/transformers"],
	},
	{
		name: "@opencut/audio",
		description: "Audio engine, 10-band EQ, reverb, compressor, beat detection, varispeed",
		entry: "packages/audio/src/index.ts",
		dependencies: [],
		externalDependencies: [],
	},
	{
		name: "@opencut/studio",
		description: "Full UI — React components, panels, timeline view, preview, export UI",
		entry: "packages/studio/src/index.ts",
		dependencies: [
			"@opencut/timeline",
			"@opencut/renderer",
			"@opencut/effects",
			"@opencut/ai",
			"@opencut/audio",
		],
		externalDependencies: ["react", "react-dom", "zustand", "three"],
	},
];

export function validatePackageDependencies(): { errors: string[]; warnings: string[] } {
	const errors: string[] = [];
	const warnings: string[] = [];
	const packageNames = new Set(SDK_PACKAGES.map(p => p.name));

	for (const pkg of SDK_PACKAGES) {
		for (const dep of pkg.dependencies) {
			if (!packageNames.has(dep)) {
				errors.push(`${pkg.name}: dependency ${dep} not found in SDK packages`);
			}
		}
	}

	// Check for circular dependencies
	const visited = new Set<string>();
	const stack = new Set<string>();

	function detectCycle(name: string): boolean {
		if (stack.has(name)) return true;
		if (visited.has(name)) return false;

		visited.add(name);
		stack.add(name);

		const pkg = SDK_PACKAGES.find(p => p.name === name);
		if (pkg) {
			for (const dep of pkg.dependencies) {
				if (detectCycle(dep)) {
					errors.push(`Circular dependency detected: ${name} → ${dep}`);
					return true;
				}
			}
		}

		stack.delete(name);
		return false;
	}

	for (const pkg of SDK_PACKAGES) {
		detectCycle(pkg.name);
	}

	return { errors, warnings };
}
