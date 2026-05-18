export interface PluginManifest {
	id: string;
	name: string;
	version: string;
	description: string;
	author: string;
	license: string;
	homepage?: string;
	icon?: string;
	capabilities: PluginCapability[];
	dependencies?: string[];
	minOpenCutVersion: string;
}

export type PluginCapability =
	| { type: "effect"; definition: PluginEffectDefinition }
	| { type: "transition"; definition: PluginTransitionDefinition }
	| { type: "export-format"; definition: PluginExportFormat }
	| { type: "audio-effect"; definition: PluginAudioEffectDefinition }
	| { type: "generator"; definition: PluginGeneratorDefinition };

export interface PluginEffectDefinition {
	type: string;
	name: string;
	keywords: string[];
	params: PluginParamDefinition[];
	shader?: string;
	renderFn?: string;
}

export interface PluginTransitionDefinition {
	type: string;
	name: string;
	duration: number;
	shader?: string;
	renderFn?: string;
}

export interface PluginExportFormat {
	id: string;
	name: string;
	extension: string;
	mimeType: string;
	description: string;
	encodeFn?: string;
}

export interface PluginAudioEffectDefinition {
	type: string;
	name: string;
	keywords: string[];
	params: PluginParamDefinition[];
	processFn?: string;
}

export interface PluginGeneratorDefinition {
	type: string;
	name: string;
	keywords: string[];
	params: PluginParamDefinition[];
	generateFn?: string;
}

export interface PluginParamDefinition {
	key: string;
	label: string;
	type: "number" | "select" | "color" | "boolean" | "text";
	default?: unknown;
	min?: number;
	max?: number;
	step?: number;
	options?: Array<{ value: string; label: string }>;
}

export interface PluginContext {
	editorCore: unknown;
	timeline: unknown;
	renderer: unknown;
	audioEngine: unknown;
}

export interface PluginAPI {
	registerEffect(definition: PluginEffectDefinition): void;
	registerTransition(definition: PluginTransitionDefinition): void;
	registerExportFormat(definition: PluginExportFormat): void;
	registerAudioEffect(definition: PluginAudioEffectDefinition): void;
	registerGenerator(definition: PluginGeneratorDefinition): void;
	getProjectInfo(): { duration: number; fps: number; width: number; height: number };
	getSelectedElements(): Array<{ id: string; trackId: string; type: string }>;
	addCommand(id: string, label: string, handler: () => void): void;
	showNotification(message: string, type?: "info" | "success" | "error"): void;
}

export type PluginStatus = "loading" | "active" | "error" | "disabled";

export interface PluginInstance {
	manifest: PluginManifest;
	status: PluginStatus;
	error?: string;
	api: PluginAPI;
	context: PluginContext;
	cleanup?: () => void;
}
