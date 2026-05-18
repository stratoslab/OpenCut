"use client";

import { useState, useEffect } from "react";
import { PanelView } from "@/components/editor/panels/assets/views/base-panel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { proxyManager, type ProxyConfig, type ProxyEntry, type ProxyGenerationProgress } from "@/media/proxy-manager";
import { Settings01Icon, Delete01Icon, Refresh01Icon, PauseCircleIcon, PlayCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/utils/ui";
import { toast } from "sonner";

type ProxyTab = "status" | "config" | "cache";

export function ProxyView() {
	const [activeTab, setActiveTab] = useState<ProxyTab>("status");
	const [proxies, setProxies] = useState<ProxyEntry[]>(proxyManager.getAllProxies());
	const [progress, setProgress] = useState<ProxyGenerationProgress | null>(null);
	const [isGenerating, setIsGenerating] = useState(false);
	const [config, setConfig] = useState<ProxyConfig>(proxyManager.getConfig());

	useEffect(() => {
		const interval = setInterval(() => {
			setProxies(proxyManager.getAllProxies());
		}, 1000);
		return () => clearInterval(interval);
	}, []);

	const handleClearCache = () => {
		proxyManager.clearCache();
		setProxies([]);
		toast.success("Proxy cache cleared");
	};

	const handleEvictOld = () => {
		proxyManager.evictOldProxies();
		setProxies(proxyManager.getAllProxies());
		toast.success("Old proxies evicted");
	};

	const handleCancel = () => {
		proxyManager.cancelGeneration();
		setIsGenerating(false);
		setProgress(null);
		toast.info("Proxy generation cancelled");
	};

	const handleSaveConfig = () => {
		proxyManager.updateConfig(config);
		toast.success("Proxy config saved");
	};

	const tabs: { id: ProxyTab; label: string }[] = [
		{ id: "status", label: "Status" },
		{ id: "config", label: "Config" },
		{ id: "cache", label: "Cache" },
	];

	return (
		<PanelView title="Proxy">
			<div className="flex h-full flex-col">
				<div className="flex border-b">
					{tabs.map((tab) => (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							className={cn(
								"flex-1 px-3 py-2 text-xs font-medium hover:bg-accent",
								activeTab === tab.id
									? "border-b-2 border-primary text-foreground"
									: "text-muted-foreground"
							)}
						>
							{tab.label}
						</button>
					))}
				</div>

				<div className="flex-1 overflow-y-auto p-3">
					{activeTab === "status" && (
						<StatusPanel
							progress={progress}
							isGenerating={isGenerating}
							onCancel={handleCancel}
						/>
					)}
					{activeTab === "config" && (
						<ConfigPanel
							config={config}
							onChange={setConfig}
							onSave={handleSaveConfig}
						/>
					)}
					{activeTab === "cache" && (
						<CachePanel
							proxies={proxies}
							onClear={handleClearCache}
							onEvict={handleEvictOld}
						/>
					)}
				</div>
			</div>
		</PanelView>
	);
}

function StatusPanel({
	progress,
	isGenerating,
	onCancel,
}: {
	progress: ProxyGenerationProgress | null;
	isGenerating: boolean;
	onCancel: () => void;
}) {
	return (
		<div className="space-y-4">
			<h4 className="text-sm font-medium">Generation Status</h4>

			{isGenerating && progress ? (
				<div className="space-y-3 rounded border p-4">
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium">Generating Proxies...</span>
						<HugeiconsIcon icon={PauseCircleIcon} className="size-4 animate-pulse text-primary" />
					</div>

					<div className="h-2 overflow-hidden rounded bg-muted">
						<div
							className="h-full bg-primary transition-all duration-300"
							style={{ width: `${progress.percent}%` }}
						/>
					</div>

					<div className="flex justify-between text-xs text-muted-foreground">
						<span>{progress.current} / {progress.total} frames</span>
						<span>{progress.percent.toFixed(0)}%</span>
					</div>

					<div className="flex justify-between text-xs">
						<span>ETA: {progress.eta.toFixed(0)}s</span>
						<button
							onClick={onCancel}
							className="text-destructive hover:underline"
						>
							Cancel
						</button>
					</div>
				</div>
			) : (
				<div className="rounded border p-4 text-center">
					<p className="text-muted-foreground text-sm">Idle</p>
					<p className="text-muted-foreground text-xs mt-1">
						Proxies are generated automatically when media is uploaded
					</p>
				</div>
			)}
		</div>
	);
}

function ConfigPanel({
	config,
	onChange,
	onSave,
}: {
	config: ProxyConfig;
	onChange: (c: ProxyConfig) => void;
	onSave: () => void;
}) {
	return (
		<div className="space-y-4">
			<h4 className="text-sm font-medium">Proxy Configuration</h4>

			<div className="space-y-2">
				<div className="flex justify-between">
					<Label className="text-xs">Max Width</Label>
					<span className="text-muted-foreground text-xs">{config.maxResolution.width}px</span>
				</div>
				<Slider
					value={[config.maxResolution.width]}
					onValueChange={([v]) =>
						onChange({ ...config, maxResolution: { ...config.maxResolution, width: v } })
					}
					min={320}
					max={1920}
					step={80}
				/>
			</div>

			<div className="space-y-2">
				<div className="flex justify-between">
					<Label className="text-xs">Max Height</Label>
					<span className="text-muted-foreground text-xs">{config.maxResolution.height}px</span>
				</div>
				<Slider
					value={[config.maxResolution.height]}
					onValueChange={([v]) =>
						onChange({ ...config, maxResolution: { ...config.maxResolution, height: v } })
					}
					min={240}
					max={1080}
					step={60}
				/>
			</div>

			<div className="space-y-2">
				<div className="flex justify-between">
					<Label className="text-xs">Quality</Label>
					<span className="text-muted-foreground text-xs">{(config.quality * 100).toFixed(0)}%</span>
				</div>
				<Slider
					value={[config.quality]}
					onValueChange={([v]) => onChange({ ...config, quality: v })}
					min={0.1}
					max={1}
					step={0.05}
				/>
			</div>

			<div className="space-y-2">
				<Label className="text-xs">Format</Label>
				<Select
					value={config.format}
					onValueChange={(v) => onChange({ ...config, format: v as ProxyConfig["format"] })}
				>
					<SelectTrigger className="h-7 text-xs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="webp">WebP</SelectItem>
						<SelectItem value="jpeg">JPEG</SelectItem>
						<SelectItem value="png">PNG</SelectItem>
					</SelectContent>
				</Select>
			</div>

			<div className="space-y-2">
				<Label className="text-xs">Cache Location</Label>
				<Select
					value={config.cacheLocation}
					onValueChange={(v) => onChange({ ...config, cacheLocation: v as ProxyConfig["cacheLocation"] })}
				>
					<SelectTrigger className="h-7 text-xs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="opfs">OPFS</SelectItem>
						<SelectItem value="indexeddb">IndexedDB</SelectItem>
					</SelectContent>
				</Select>
			</div>

			<Button size="sm" className="w-full text-xs" onClick={onSave}>
				Save Configuration
			</Button>
		</div>
	);
}

function CachePanel({
	proxies,
	onClear,
	onEvict,
}: {
	proxies: ProxyEntry[];
	onClear: () => void;
	onEvict: () => void;
}) {
	const totalSize = proxies.reduce((sum, p) => sum + (p.width * p.height * 4) / 1024 / 1024, 0);

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<h4 className="text-sm font-medium">Proxy Cache</h4>
				<div className="flex gap-1">
					<Button
						size="sm"
						variant="outline"
						className="h-6 gap-1 text-xs"
						onClick={onEvict}
					>
						<HugeiconsIcon icon={Refresh01Icon} className="size-3" />
						Evict Old
					</Button>
					<Button
						size="sm"
						variant="outline"
						className="h-6 gap-1 text-xs"
						onClick={onClear}
					>
						<HugeiconsIcon icon={Delete01Icon} className="size-3" />
						Clear All
					</Button>
				</div>
			</div>

			<div className="rounded bg-accent p-3 text-center">
				<p className="text-2xl font-bold">{proxies.length}</p>
				<p className="text-muted-foreground text-xs">proxies · ~{totalSize.toFixed(1)} MB</p>
			</div>

			<div className="max-h-48 overflow-y-auto space-y-1">
				{proxies.map((proxy) => (
					<div
						key={proxy.id}
						className="flex items-center justify-between rounded border px-2 py-1.5 text-xs"
					>
						<div className="min-w-0 flex-1">
							<p className="truncate font-medium">{proxy.sourceId}</p>
							<p className="text-muted-foreground text-[10px]">
								{proxy.width}×{proxy.height}
							</p>
						</div>
						<span className="text-muted-foreground text-[10px]">
							{new Date(proxy.createdAt).toLocaleTimeString()}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}
