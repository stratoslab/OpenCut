export interface TimeRange { start: number; end: number; }
export interface VolumeAutomation { time: number; volume: number; }

export class AutoDucker {
	generate(
		speechRegions: TimeRange[],
		options: { duckAmount?: number; attackTime?: number; releaseTime?: number } = {},
	): VolumeAutomation[] {
		const duckAmount = options.duckAmount ?? 0.3;
		const attackTime = options.attackTime ?? 0.1;
		const releaseTime = options.releaseTime ?? 0.2;
		const automations: VolumeAutomation[] = [];

		for (const region of speechRegions) {
			automations.push({ time: region.start - attackTime, volume: 1 });
			automations.push({ time: region.start, volume: duckAmount });
			automations.push({ time: region.end, volume: duckAmount });
			automations.push({ time: region.end + releaseTime, volume: 1 });
		}

		return automations.sort((a, b) => a.time - b.time);
	}
}
