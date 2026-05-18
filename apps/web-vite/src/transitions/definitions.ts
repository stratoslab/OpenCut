export interface TransitionDefinition {
	type: string;
	name: string;
	icon: string;
	defaultDuration: number;
}

export const TRANSITIONS: TransitionDefinition[] = [
	{ type: "crossfade", name: "Crossfade", icon: "crossfade", defaultDuration: 1.0 },
	{ type: "slide-left", name: "Slide Left", icon: "arrow-left", defaultDuration: 0.8 },
	{ type: "slide-right", name: "Slide Right", icon: "arrow-right", defaultDuration: 0.8 },
	{ type: "wipe-left", name: "Wipe Left", icon: "wipe-left", defaultDuration: 0.6 },
	{ type: "wipe-right", name: "Wipe Right", icon: "wipe-right", defaultDuration: 0.6 },
	{ type: "iris", name: "Iris", icon: "circle", defaultDuration: 1.0 },
	{ type: "clock-wipe", name: "Clock Wipe", icon: "clock", defaultDuration: 1.0 },
	{ type: "glitch", name: "Glitch", icon: "zap", defaultDuration: 0.5 },
];
