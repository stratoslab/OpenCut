export interface ProjectTemplate {
	id: string;
	name: string;
	description: string;
	thumbnail?: string;
	category: TemplateCategory;
	settings: TemplateSettings;
	tracks: TemplateTrack[];
	effects: TemplateEffect[];
	transitions: TemplateTransition[];
	textStyles: TemplateTextStyle[];
	author?: string;
	version: string;
	createdAt: string;
	tags: string[];
}

export type TemplateCategory =
	| "youtube"
	| "tiktok"
	| "instagram"
	| "podcast"
	| "tutorial"
	| "vlog"
	| "commercial"
	| "presentation"
	| "music-video"
	| "custom";

export interface TemplateSettings {
	canvasWidth: number;
	canvasHeight: number;
	fps: number;
	audioSampleRate: number;
	colorProfile: "srgb" | "rec709" | "rec2020";
}

export interface TemplateTrack {
	id: string;
	type: "video" | "audio" | "text" | "graphics";
	name: string;
	isLocked: boolean;
	isMuted: boolean;
	isHidden: boolean;
	elements: TemplateElement[];
}

export interface TemplateElement {
	id: string;
	type: string;
	startTime: number;
	duration: number;
	name: string;
	params: Record<string, unknown>;
	effects: TemplateEffect[];
	animations: TemplateAnimation[];
}

export interface TemplateEffect {
	id: string;
	type: string;
	params: Record<string, unknown>;
	startTime?: number;
	duration?: number;
}

export interface TemplateTransition {
	id: string;
	type: string;
	duration: number;
	position: "start" | "end" | "between";
	targetElementId?: string;
}

export interface TemplateTextStyle {
	id: string;
	name: string;
	fontFamily: string;
	fontSize: number;
	fontWeight: string;
	color: string;
	backgroundColor?: string;
	outlineColor?: string;
	outlineWidth?: number;
	shadowColor?: string;
	shadowBlur?: number;
	animation?: string;
}

export interface TemplateAnimation {
	id: string;
	type: "fade-in" | "fade-out" | "slide-in" | "slide-out" | "zoom-in" | "zoom-out" | "bounce" | "typewriter";
	duration: number;
	easing: string;
	params: Record<string, unknown>;
}

export interface TemplatePreset {
	id: string;
	name: string;
	description: string;
	category: string;
	effects: TemplateEffect[];
	textStyles: TemplateTextStyle[];
	transitions: TemplateTransition[];
}

export const DEFAULT_TEMPLATES: ProjectTemplate[] = [
	{
		id: "youtube-standard",
		name: "YouTube Standard",
		description: "16:9 format with intro/outro placeholders and lower thirds",
		category: "youtube",
		settings: {
			canvasWidth: 1920,
			canvasHeight: 1080,
			fps: 30,
			audioSampleRate: 48000,
			colorProfile: "rec709",
		},
		tracks: [
			{
				id: "main-video",
				type: "video",
				name: "Main Video",
				isLocked: false,
				isMuted: false,
				isHidden: false,
				elements: [],
			},
			{
				id: "b-roll",
				type: "video",
				name: "B-Roll",
				isLocked: false,
				isMuted: false,
				isHidden: false,
				elements: [],
			},
			{
				id: "text-overlay",
				type: "text",
				name: "Text & Graphics",
				isLocked: false,
				isMuted: false,
				isHidden: false,
				elements: [],
			},
			{
				id: "audio-music",
				type: "audio",
				name: "Background Music",
				isLocked: false,
				isMuted: false,
				isHidden: false,
				elements: [],
			},
			{
				id: "audio-sfx",
				type: "audio",
				name: "Sound Effects",
				isLocked: false,
				isMuted: false,
				isHidden: false,
				elements: [],
			},
		],
		effects: [],
		transitions: [],
		textStyles: [
			{
				id: "title-style",
				name: "Title",
				fontFamily: "Inter",
				fontSize: 72,
				fontWeight: "bold",
				color: "#FFFFFF",
				outlineColor: "#000000",
				outlineWidth: 2,
				shadowColor: "rgba(0,0,0,0.5)",
				shadowBlur: 10,
			},
			{
				id: "subtitle-style",
				name: "Subtitle",
				fontFamily: "Inter",
				fontSize: 36,
				fontWeight: "normal",
				color: "#FFFFFF",
				backgroundColor: "rgba(0,0,0,0.7)",
			},
			{
				id: "lower-third",
				name: "Lower Third",
				fontFamily: "Inter",
				fontSize: 28,
				fontWeight: "600",
				color: "#FFFFFF",
				backgroundColor: "rgba(0,0,0,0.8)",
			},
		],
		author: "StratosCut",
		version: "1.0.0",
		createdAt: new Date().toISOString(),
		tags: ["youtube", "16:9", "standard"],
	},
	{
		id: "tiktok-vertical",
		name: "TikTok / Reels",
		description: "9:16 vertical format optimized for mobile viewing",
		category: "tiktok",
		settings: {
			canvasWidth: 1080,
			canvasHeight: 1920,
			fps: 30,
			audioSampleRate: 48000,
			colorProfile: "srgb",
		},
		tracks: [
			{
				id: "main-video",
				type: "video",
				name: "Main Video",
				isLocked: false,
				isMuted: false,
				isHidden: false,
				elements: [],
			},
			{
				id: "text-overlay",
				type: "text",
				name: "Text Overlay",
				isLocked: false,
				isMuted: false,
				isHidden: false,
				elements: [],
			},
			{
				id: "audio",
				type: "audio",
				name: "Audio",
				isLocked: false,
				isMuted: false,
				isHidden: false,
				elements: [],
			},
		],
		effects: [],
		transitions: [],
		textStyles: [
			{
				id: "caption-style",
				name: "Caption",
				fontFamily: "Inter",
				fontSize: 48,
				fontWeight: "bold",
				color: "#FFFFFF",
				outlineColor: "#000000",
				outlineWidth: 3,
			},
		],
		author: "StratosCut",
		version: "1.0.0",
		createdAt: new Date().toISOString(),
		tags: ["tiktok", "reels", "9:16", "vertical"],
	},
	{
		id: "podcast-standard",
		name: "Podcast",
		description: "Audio-first template with waveform visualization and chapter markers",
		category: "podcast",
		settings: {
			canvasWidth: 1920,
			canvasHeight: 1080,
			fps: 30,
			audioSampleRate: 48000,
			colorProfile: "rec709",
		},
		tracks: [
			{
				id: "host-audio",
				type: "audio",
				name: "Host",
				isLocked: false,
				isMuted: false,
				isHidden: false,
				elements: [],
			},
			{
				id: "guest-audio",
				type: "audio",
				name: "Guest",
				isLocked: false,
				isMuted: false,
				isHidden: false,
				elements: [],
			},
			{
				id: "music",
				type: "audio",
				name: "Background Music",
				isLocked: false,
				isMuted: false,
				isHidden: false,
				elements: [],
			},
		],
		effects: [],
		transitions: [],
		textStyles: [
			{
				id: "chapter-title",
				name: "Chapter Title",
				fontFamily: "Inter",
				fontSize: 48,
				fontWeight: "bold",
				color: "#FFFFFF",
			},
		],
		author: "StratosCut",
		version: "1.0.0",
		createdAt: new Date().toISOString(),
		tags: ["podcast", "audio", "interview"],
	},
];

export class TemplateManager {
	private templates: Map<string, ProjectTemplate> = new Map();
	private presets: Map<string, TemplatePreset> = new Map();

	constructor() {
		for (const template of DEFAULT_TEMPLATES) {
			this.templates.set(template.id, template);
		}
	}

	registerTemplate(template: ProjectTemplate): void {
		this.templates.set(template.id, template);
	}

	registerPreset(preset: TemplatePreset): void {
		this.presets.set(preset.id, preset);
	}

	getTemplate(id: string): ProjectTemplate | undefined {
		return this.templates.get(id);
	}

	getAllTemplates(): ProjectTemplate[] {
		return Array.from(this.templates.values());
	}

	getTemplatesByCategory(category: TemplateCategory): ProjectTemplate[] {
		return Array.from(this.templates.values()).filter(t => t.category === category);
	}

	getPreset(id: string): TemplatePreset | undefined {
		return this.presets.get(id);
	}

	getAllPresets(): TemplatePreset[] {
		return Array.from(this.presets.values());
	}

	createFromTemplate(template: ProjectTemplate, overrides?: Partial<ProjectTemplate>): ProjectTemplate {
		return {
			...template,
			id: `custom-${crypto.randomUUID()}`,
			createdAt: new Date().toISOString(),
			...overrides,
			tracks: template.tracks.map(track => ({
				...track,
				elements: track.elements.map(el => ({
					...el,
					id: `el-${crypto.randomUUID()}`,
				})),
			})),
		};
	}

	exportTemplate(template: ProjectTemplate): string {
		return JSON.stringify(template, null, 2);
	}

	importTemplate(json: string): ProjectTemplate {
		const parsed = JSON.parse(json);
		this.validateTemplate(parsed);
		return parsed;
	}

	private validateTemplate(template: Record<string, unknown>): void {
		const required = ["id", "name", "settings", "tracks"];
		for (const key of required) {
			if (!(key in template)) {
				throw new Error(`Invalid template: missing ${key}`);
			}
		}

		const settings = template.settings as Record<string, unknown>;
		if (!settings.canvasWidth || !settings.canvasHeight || !settings.fps) {
			throw new Error("Invalid template: missing required settings");
		}
	}
}

export const templateManager = new TemplateManager();
