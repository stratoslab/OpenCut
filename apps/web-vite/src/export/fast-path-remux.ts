import type { TScene } from "@/timeline/types";

export interface RemuxResult {
	remuxable: boolean;
	reason?: string;
}

export function canRemuxSingleClip(scene: TScene): RemuxResult {
	const mainTrack = scene.tracks.main;
	const overlayTracks = scene.tracks.overlay || [];

	if (!mainTrack || mainTrack.elements.length === 0) {
		return { remuxable: false, reason: "No main track elements" };
	}

	if (mainTrack.elements.length !== 1) {
		return { remuxable: false, reason: "Multiple elements in main track" };
	}

	const element = mainTrack.elements[0];

	if (element.type !== "video") {
		return { remuxable: false, reason: "Main element is not a video" };
	}

	if (element.startTime !== 0) {
		return { remuxable: false, reason: "Video does not start at 0" };
	}

	if (element.trimStart !== undefined && element.trimStart > 0) {
		return { remuxable: false, reason: "Video has trim at start" };
	}

	if (overlayTracks.length > 0 && overlayTracks.some(t => t.elements.length > 0)) {
		return { remuxable: false, reason: "Overlay tracks have content" };
	}

	if (element.speed && element.speed !== 1) {
		return { remuxable: false, reason: "Video has speed modification" };
	}

	if (element.volume !== undefined && element.volume !== 1) {
		return { remuxable: false, reason: "Video has volume modification" };
	}

	if (element.filters && element.filters.length > 0) {
		return { remuxable: false, reason: "Video has filters applied" };
	}

	if (element.opacity !== undefined && element.opacity !== 1) {
		return { remuxable: false, reason: "Video has opacity modification" };
	}

	const audioTracks = scene.tracks.audio || [];
	if (audioTracks.length > 0) {
		return { remuxable: false, reason: "Additional audio tracks present" };
	}

	return { remuxable: true };
}

export async function remuxSingleClip(
	source: Blob,
	startTime: number,
	endTime: number,
): Promise<Blob | null> {
	if (startTime === 0 && endTime === 0) {
		return source;
	}

	try {
		const video = document.createElement("video");
		video.preload = "auto";
		video.muted = true;

		const url = URL.createObjectURL(source);

		return new Promise((resolve) => {
			video.onloadedmetadata = async () => {
				const duration = video.duration;
				const actualEnd = endTime > 0 ? Math.min(endTime, duration) : duration;

				if ("MediaSource" in window) {
					const ms = new MediaSource();
					video.src = URL.createObjectURL(ms);

					ms.addEventListener("sourceopen", async () => {
						const sourceBuffer = ms.addSourceBuffer("video/mp4; codecs=\"avc1.42001E\"");
						const arrayBuffer = await source.arrayBuffer();

						sourceBuffer.appendBuffer(arrayBuffer);
						sourceBuffer.addEventListener("updateend", () => {
							ms.endOfStream();
							URL.revokeObjectURL(url);
							resolve(source.slice(
								Math.floor(startTime * (source.size / duration)),
								Math.floor(actualEnd * (source.size / duration)),
							));
						});
					});
				} else {
					URL.revokeObjectURL(url);
					resolve(source);
				}
			};

			video.onerror = () => {
				URL.revokeObjectURL(url);
				resolve(source);
			};

			video.src = url;
		});
	} catch {
		return source;
	}
}
