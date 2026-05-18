export interface ExportConfig {
	resolution: "original" | "1080p" | "720p" | "480p";
	format: "mp4" | "webm";
	quality: "low" | "medium" | "high";
	fps: number;
	includeAudio: boolean;
}

export const BITRATE_PRESETS: Record<string, number> = {
	low: 2_000_000,
	medium: 5_000_000,
	high: 10_000_000,
};

export const RESOLUTION_MAP: Record<string, { w: number; h: number }> = {
	"1080p": { w: 1920, h: 1080 },
	"720p": { w: 1280, h: 720 },
	"480p": { w: 854, h: 480 },
};

export function getExportResolution(
	config: ExportConfig,
	projectWidth: number,
	projectHeight: number,
): { w: number; h: number } {
	if (config.resolution === "original") {
		return { w: projectWidth, h: projectHeight };
	}

	const target = RESOLUTION_MAP[config.resolution];
	const aspect = projectWidth / projectHeight;

	if (aspect > target.w / target.h) {
		return { w: target.w, h: Math.round(target.w / aspect) };
	} else {
		return { w: Math.round(target.h * aspect), h: target.h };
	}
}
