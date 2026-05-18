import type {
	PluginManifest,
	PluginInstance,
	PluginCapability,
	PluginStatus,
	PluginAPI,
	PluginContext,
	PluginEffectDefinition,
	PluginTransitionDefinition,
	PluginExportFormat,
	PluginAudioEffectDefinition,
	PluginGeneratorDefinition,
} from "./types";
import { effectsRegistry } from "@/effects/registry";
import { transitionsRegistry } from "@/transitions/registry";
import { exportFormatsRegistry } from "@/export/formats";

class PluginManager {
	private plugins: Map<string, PluginInstance> = new Map();
	private eventListeners: Map<string, Array<() => void>> = new Map();

	async loadPlugin(manifest: PluginManifest, module: Record<string, unknown>): Promise<PluginInstance> {
		if (this.plugins.has(manifest.id)) {
			throw new Error(`Plugin ${manifest.id} already loaded`);
		}

		const status: PluginStatus = "loading";
		const context: PluginContext = {
			editorCore: null,
			timeline: null,
			renderer: null,
			audioEngine: null,
		};

		const api = this.createPluginAPI(manifest.id);

		const instance: PluginInstance = {
			manifest,
			status,
			api,
			context,
		};

		this.plugins.set(manifest.id, instance);

		try {
			const initFn = (module as Record<string, (api: PluginAPI, context: PluginContext) => void>).init;
			if (initFn) {
				const cleanup = initFn(api, context);
				if (typeof cleanup === "function") {
					instance.cleanup = cleanup;
				}
			}

			instance.status = "active";
			this.emit("plugin-loaded", manifest.id);
		} catch (error) {
			instance.status = "error";
			instance.error = error instanceof Error ? error.message : String(error);
			this.plugins.delete(manifest.id);
			throw error;
		}

		return instance;
	}

	async unloadPlugin(pluginId: string): Promise<void> {
		const instance = this.plugins.get(pluginId);
		if (!instance) return;

		try {
			if (instance.cleanup) {
				instance.cleanup();
			}

			this.unregisterPluginCapabilities(instance);
			instance.status = "disabled";
			this.plugins.delete(pluginId);
			this.emit("plugin-unloaded", pluginId);
		} catch (error) {
			instance.status = "error";
			instance.error = error instanceof Error ? error.message : String(error);
			throw error;
		}
	}

	getPlugin(pluginId: string): PluginInstance | undefined {
		return this.plugins.get(pluginId);
	}

	getAllPlugins(): PluginInstance[] {
		return Array.from(this.plugins.values());
	}

	getActivePlugins(): PluginInstance[] {
		return Array.from(this.plugins.values()).filter(p => p.status === "active");
	}

	on(event: string, listener: () => void): void {
		if (!this.eventListeners.has(event)) {
			this.eventListeners.set(event, []);
		}
		this.eventListeners.get(event)!.push(listener);
	}

	off(event: string, listener: () => void): void {
		const listeners = this.eventListeners.get(event);
		if (listeners) {
			const idx = listeners.indexOf(listener);
			if (idx !== -1) listeners.splice(idx, 1);
		}
	}

	private emit(event: string, ..._args: unknown[]): void {
		const listeners = this.eventListeners.get(event);
		if (listeners) {
			for (const listener of listeners) {
				listener();
			}
		}
	}

	private createPluginAPI(pluginId: string): PluginAPI {
		return {
			registerEffect: (definition: PluginEffectDefinition) => {
				effectsRegistry.register({
					key: `${pluginId}:${definition.type}`,
					definition: {
						type: definition.type,
						name: definition.name,
						keywords: definition.keywords,
						params: definition.params,
						renderer: {
							passes: definition.shader
								? [{ shader: definition.shader, uniforms: () => ({}) }]
								: [],
						},
					},
				});
			},
			registerTransition: (definition: PluginTransitionDefinition) => {
				transitionsRegistry.register({
					key: `${pluginId}:${definition.type}`,
					definition: {
						type: definition.type,
						name: definition.name,
						duration: definition.duration,
						render: definition.renderFn
							? () => ({})
							: () => ({}),
					},
				});
			},
			registerExportFormat: (definition: PluginExportFormat) => {
				exportFormatsRegistry.register({
					id: `${pluginId}:${definition.id}`,
					name: definition.name,
					extension: definition.extension,
					mimeType: definition.mimeType,
					description: definition.description,
				});
			},
			registerAudioEffect: (_definition: PluginAudioEffectDefinition) => {
				// Audio effects registry placeholder
			},
			registerGenerator: (_definition: PluginGeneratorDefinition) => {
				// Generators registry placeholder
			},
			getProjectInfo: () => ({
				duration: 0,
				fps: 30,
				width: 1920,
				height: 1080,
			}),
			getSelectedElements: () => [],
			addCommand: (_id: string, _label: string, _handler: () => void) => {},
			showNotification: (_message: string, _type?: "info" | "success" | "error") => {},
		};
	}

	private unregisterPluginCapabilities(instance: PluginInstance): void {
		const pluginId = instance.manifest.id;

		for (const capability of instance.manifest.capabilities) {
			this.unregisterCapability(pluginId, capability);
		}
	}

	private unregisterCapability(pluginId: string, capability: PluginCapability): void {
		switch (capability.type) {
			case "effect":
				effectsRegistry.unregister(`${pluginId}:${capability.definition.type}`);
				break;
			case "transition":
				transitionsRegistry.unregister(`${pluginId}:${capability.definition.type}`);
				break;
			case "export-format":
				exportFormatsRegistry.unregister(`${pluginId}:${capability.definition.id}`);
				break;
		}
	}
}

export const pluginManager = new PluginManager();
