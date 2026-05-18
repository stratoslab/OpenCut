export interface ProjectBundle {
	version: string;
	createdAt: string;
	metadata: BundleMetadata;
	project: Record<string, unknown>;
	media: BundleMediaReference[];
	aiModels: string[];
	checksum: string;
}

export interface BundleMetadata {
	name: string;
	description: string;
	author: string;
	appVersion: string;
	platform: string;
}

export interface BundleMediaReference {
	id: string;
	name: string;
	type: "video" | "audio" | "image";
	sizeBytes: number;
	checksum: string;
	data?: ArrayBuffer;
}

export interface BundleValidationResult {
	valid: boolean;
	errors: string[];
	warnings: string[];
}

export class ProjectBundler {
	async createBundle(
		projectData: Record<string, unknown>,
		mediaFiles: Array<{ id: string; name: string; type: string; file: File }>,
		metadata: Partial<BundleMetadata> = {},
	): Promise<ProjectBundle> {
		const bundle: ProjectBundle = {
			version: "1.0.0",
			createdAt: new Date().toISOString(),
			metadata: {
				name: "Untitled Project",
				description: "",
				author: "OpenCut User",
				appVersion: "0.6.0",
				platform: typeof navigator !== "undefined" ? navigator.platform : "unknown",
				...metadata,
			},
			project: projectData,
			media: [],
			aiModels: [],
			checksum: "",
		};

		for (const media of mediaFiles) {
			const buffer = await media.file.arrayBuffer();
			const checksum = await this.computeChecksum(buffer);

			bundle.media.push({
				id: media.id,
				name: media.name,
				type: media.type as BundleMediaReference["type"],
				sizeBytes: buffer.byteLength,
				checksum,
				data: buffer,
			});
		}

		bundle.checksum = await this.computeBundleChecksum(bundle);
		return bundle;
	}

	async exportBundle(bundle: ProjectBundle): Promise<Blob> {
		const json = JSON.stringify({
			...bundle,
			media: bundle.media.map(m => ({
				...m,
				data: undefined,
			})),
		});

		const parts: BlobPart[] = [json];

		for (const media of bundle.media) {
			if (media.data) {
				parts.push(new Uint8Array(media.data));
			}
		}

		return new Blob(parts, { type: "application/x-opencut" });
	}

	async importBundle(blob: Blob): Promise<ProjectBundle> {
		const jsonPart = await blob.text();
		const bundle = JSON.parse(jsonPart) as ProjectBundle;

		const validation = this.validateBundle(bundle);
		if (!validation.valid) {
			throw new Error(`Invalid bundle: ${validation.errors.join(", ")}`);
		}

		return bundle;
	}

	validateBundle(bundle: Record<string, unknown>): BundleValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		const required = ["version", "createdAt", "metadata", "project"];
		for (const key of required) {
			if (!(key in bundle)) {
				errors.push(`Missing required field: ${key}`);
			}
		}

		const version = bundle.version as string;
		if (version && !version.startsWith("1.")) {
			warnings.push(`Unknown bundle version: ${version}`);
		}

		const media = bundle.media as BundleMediaReference[] | undefined;
		if (media) {
			for (const m of media) {
				if (!m.id || !m.name || !m.type) {
					errors.push(`Invalid media entry: missing id, name, or type`);
				}
			}
		}

		return { valid: errors.length === 0, errors, warnings };
	}

	private async computeChecksum(data: ArrayBuffer): Promise<string> {
		const hashBuffer = await crypto.subtle.digest("SHA-256", data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
	}

	private async computeBundleChecksum(bundle: ProjectBundle): Promise<string> {
		const data = JSON.stringify({
			version: bundle.version,
			createdAt: bundle.createdAt,
			metadata: bundle.metadata,
			project: bundle.project,
			media: bundle.media.map(m => ({ id: m.id, checksum: m.checksum })),
		});
		const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
	}
}

export const projectBundler = new ProjectBundler();
