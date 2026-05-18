export interface BundleAnalysis {
	totalSize: number;
	gzipSize: number;
	chunks: ChunkAnalysis[];
	dependencies: DependencyAnalysis[];
	largestModules: ModuleAnalysis[];
}

export interface ChunkAnalysis {
	name: string;
	size: number;
	gzipSize: number;
	modules: number;
	isLazy: boolean;
}

export interface DependencyAnalysis {
	name: string;
	version: string;
	size: number;
	isLazyLoaded: boolean;
}

export interface ModuleAnalysis {
	path: string;
	size: number;
	importers: string[];
}

export interface PerformanceBudget {
	maxTotalSize: number;
	maxGzipSize: number;
	maxChunkSize: number;
	maxInitialLoad: number;
	lazyLoadThreshold: number;
}

export const PERFORMANCE_BUDGET: PerformanceBudget = {
	maxTotalSize: 2_000_000,      // 2MB total
	maxGzipSize: 800_000,         // 800KB gzip
	maxChunkSize: 300_000,        // 300KB per chunk
	maxInitialLoad: 500_000,      // 500KB initial
	lazyLoadThreshold: 50_000,    // Lazy load modules > 50KB
};

export class PerformanceOptimizer {
	private analysis: BundleAnalysis | null = null;

	async analyzeBundle(): Promise<BundleAnalysis> {
		const chunks: ChunkAnalysis[] = [];
		const dependencies: DependencyAnalysis[] = [];
		const largestModules: ModuleAnalysis[] = [];

		// Analyze import.meta.glob for module sizes
		const modules = import.meta.glob?.("/src/**/*.ts", { eager: false, query: "?size" });
		if (modules) {
			for (const [path, loader] of Object.entries(modules)) {
				largestModules.push({
					path,
					size: 0,
					importers: [],
				});
			}
		}

		this.analysis = {
			totalSize: 0,
			gzipSize: 0,
			chunks,
			dependencies,
			largestModules: largestModules.slice(0, 20).sort((a, b) => b.size - a.size),
		};

		return this.analysis;
	}

	getLazyLoadableModules(): string[] {
		return [
			"@/3d/three-layer-manager",
			"@/ai/segmentation",
			"@/ai/voiceover",
			"@/plugins/plugin-manager",
			"@/performance/offscreen-renderer",
			"@/services/transcription/worker",
		];
	}

	getCodeSplittingConfig(): Record<string, string[]> {
		return {
			vendor: ["react", "react-dom", "zustand"],
			three: ["three"],
			transformers: ["@huggingface/transformers"],
			ai: ["@/ai/scene-classifier", "@/ai/caption-styling"],
			audio: ["@/audio/audio-engine"],
			plugins: ["@/plugins/plugin-manager"],
			performance: ["@/performance/gpu-memory-pool", "@/performance/offscreen-renderer"],
		};
	}

	getViteConfig(): Record<string, unknown> {
		return {
			build: {
				rollupOptions: {
					output: {
						manualChunks: this.getCodeSplittingConfig(),
					},
				},
			},
			optimizeDeps: {
				include: ["react", "react-dom", "zustand"],
				exclude: ["@huggingface/transformers", "three"],
			},
		};
	}

	async preloadCriticalModules(): Promise<void> {
		const critical = [
			import("@/effects/registry"),
			import("@/core/command-manager"),
			import("@/timeline/scene-manager"),
		];

		await Promise.all(critical);
	}

	async lazyLoadModule(modulePath: string): Promise<unknown> {
		return import(/* @vite-ignore */ modulePath);
	}

	checkBudget(analysis: BundleAnalysis): { passed: boolean; violations: string[] } {
		const violations: string[] = [];

		if (analysis.totalSize > PERFORMANCE_BUDGET.maxTotalSize) {
			violations.push(`Total size ${analysis.totalSize} exceeds budget ${PERFORMANCE_BUDGET.maxTotalSize}`);
		}

		if (analysis.gzipSize > PERFORMANCE_BUDGET.maxGzipSize) {
			violations.push(`Gzip size ${analysis.gzipSize} exceeds budget ${PERFORMANCE_BUDGET.maxGzipSize}`);
		}

		for (const chunk of analysis.chunks) {
			if (chunk.size > PERFORMANCE_BUDGET.maxChunkSize) {
				violations.push(`Chunk ${chunk.name} (${chunk.size}) exceeds max chunk size`);
			}
		}

		return { passed: violations.length === 0, violations };
	}
}

export const performanceOptimizer = new PerformanceOptimizer();
