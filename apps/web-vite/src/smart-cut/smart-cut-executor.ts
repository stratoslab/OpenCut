import type { EditorCore } from "@/core/editor-core";
import type { TimeRange } from "@/smart-cut/region-merger";

export async function executeSmartCut({
	editor,
	regions,
}: {
	editor: EditorCore;
	regions: TimeRange[];
}): Promise<void> {
	const scene = editor.scenes.getActiveScene();
	const mainTrack = scene.tracks.main;
	const elements = [...mainTrack.elements];

	const sortedRegions = [...regions].sort((a, b) => a.start - b.start);

	const commands: Array<() => void> = [];

	for (const region of sortedRegions) {
		for (const element of elements) {
			const elStart = element.startTime;
			const elEnd = element.startTime + element.duration;

			if (region.end <= elStart || region.start >= elEnd) continue;

			const cutStart = Math.max(region.start - elStart, 0);
			const cutEnd = Math.min(region.end - elStart, element.duration);

			if (cutEnd - cutStart <= 0) continue;

			if (cutStart > 0 && cutEnd < element.duration) {
				const trimmedDuration = element.duration - (cutEnd - cutStart);
				commands.push(() => {
					editor.timeline.updateElement({
						elementId: element.id,
						updates: { duration: trimmedDuration, trimEnd: cutStart },
					});
				});
			} else if (cutStart === 0) {
				commands.push(() => {
					editor.timeline.updateElement({
						elementId: element.id,
						updates: { trimStart: cutEnd },
					});
				});
			} else {
				commands.push(() => {
					editor.timeline.updateElement({
						elementId: element.id,
						updates: { trimEnd: cutStart },
					});
				});
			}
		}
	}

	for (const cmd of commands) {
		cmd();
	}

	editor.scenes.notifyListeners();
}
