"use client";

import { useState } from "react";
import { PanelView } from "@/components/editor/panels/assets/views/base-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	keyframeManager,
	type KeyframeChannel,
	type Keyframe,
	type EasingType,
	EASING_FUNCTIONS,
} from "@/animation/keyframe-manager";
import { Add01Icon, Delete01Icon, Copy01Icon, ClipboardIcon, Download01Icon, Upload01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/utils/ui";
import { toast } from "sonner";

const EASING_OPTIONS: { value: EasingType; label: string }[] = [
	{ value: "linear", label: "Linear" },
	{ value: "ease-in", label: "Ease In" },
	{ value: "ease-out", label: "Ease Out" },
	{ value: "ease-in-out", label: "Ease In-Out" },
	{ value: "bounce", label: "Bounce" },
	{ value: "elastic", label: "Elastic" },
	{ value: "back", label: "Back" },
	{ value: "circ", label: "Circ" },
	{ value: "expo", label: "Expo" },
	{ value: "sine", label: "Sine" },
	{ value: "quad", label: "Quad" },
	{ value: "cubic", label: "Cubic" },
	{ value: "quart", label: "Quart" },
	{ value: "quint", label: "Quint" },
];

export function KeyframesView() {
	const [channels, setChannels] = useState<KeyframeChannel[]>(keyframeManager.getAllChannels());
	const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
	const [showAddChannel, setShowAddChannel] = useState(false);
	const [newProperty, setNewProperty] = useState("");
	const [newEasing, setNewEasing] = useState<EasingType>("linear");

	const selectedChannel = channels.find((c) => c.id === selectedChannelId);

	const handleAddChannel = () => {
		if (!newProperty) {
			toast.error("Property name is required");
			return;
		}

		const channel: KeyframeChannel = {
			id: `ch-${crypto.randomUUID()}`,
			property: newProperty,
			keyframes: [],
			easing: newEasing,
		};

		keyframeManager.addChannel(channel);
		setChannels(keyframeManager.getAllChannels());
		setNewProperty("");
		setShowAddChannel(false);
		toast.success(`Added ${newProperty} channel`);
	};

	const handleAddKeyframe = (channelId: string) => {
		const keyframe: Keyframe = {
			id: `kf-${crypto.randomUUID()}`,
			time: 0,
			value: 0,
			easing: newEasing,
		};

		keyframeManager.addKeyframe(channelId, keyframe);
		setChannels(keyframeManager.getAllChannels());
	};

	const handleDeleteKeyframe = (channelId: string, keyframeId: string) => {
		keyframeManager.removeKeyframe(channelId, keyframeId);
		setChannels(keyframeManager.getAllChannels());
	};

	const handleUpdateKeyframe = (channelId: string, keyframeId: string, updates: Partial<Keyframe>) => {
		const channel = keyframeManager.getChannel(channelId);
		if (!channel) return;

		const kf = channel.keyframes.find((k) => k.id === keyframeId);
		if (!kf) return;

		Object.assign(kf, updates);
		channel.keyframes.sort((a, b) => a.time - b.time);
		setChannels(keyframeManager.getAllChannels());
	};

	const handleCopyKeyframes = () => {
		if (!selectedChannelId) return;
		keyframeManager.copyKeyframes([selectedChannelId], "selected");
		toast.success("Keyframes copied");
	};

	const handlePasteKeyframes = () => {
		if (!selectedChannelId) return;
		keyframeManager.pasteKeyframes(selectedChannelId);
		setChannels(keyframeManager.getAllChannels());
		toast.success("Keyframes pasted");
	};

	const handleExportKeyframes = () => {
		if (!selectedChannelId) return;
		const json = keyframeManager.exportKeyframes([selectedChannelId]);
		navigator.clipboard.writeText(json);
		toast.success("Keyframes JSON copied to clipboard");
	};

	const handleImportKeyframes = () => {
		const input = prompt("Paste keyframes JSON:");
		if (!input) return;

		try {
			keyframeManager.importKeyframes(input);
			setChannels(keyframeManager.getAllChannels());
			toast.success("Keyframes imported");
		} catch {
			toast.error("Invalid JSON");
		}
	};

	return (
		<PanelView
			title="Keyframes"
			actions={
				<div className="flex gap-1">
					<Button
						size="icon"
						variant="ghost"
						className="size-7"
						onClick={handleCopyKeyframes}
						disabled={!selectedChannelId}
					>
						<HugeiconsIcon icon={Copy01Icon} className="size-3.5" />
					</Button>
					<Button
						size="icon"
						variant="ghost"
						className="size-7"
						onClick={handlePasteKeyframes}
						disabled={!selectedChannelId}
					>
						<HugeiconsIcon icon={ClipboardIcon} className="size-3.5" />
					</Button>
					<Button
						size="icon"
						variant="ghost"
						className="size-7"
						onClick={handleExportKeyframes}
						disabled={!selectedChannelId}
					>
						<HugeiconsIcon icon={Download01Icon} className="size-3.5" />
					</Button>
					<Button
						size="icon"
						variant="ghost"
						className="size-7"
						onClick={handleImportKeyframes}
					>
						<HugeiconsIcon icon={Upload01Icon} className="size-3.5" />
					</Button>
				</div>
			}
		>
			<div className="flex h-full flex-col">
				<div className="border-b p-2">
					<div className="flex flex-col gap-1">
						{channels.length === 0 && (
							<p className="text-muted-foreground text-xs p-2">
								No keyframe channels. Add one to get started.
							</p>
						)}
						{channels.map((ch) => (
							<button
								key={ch.id}
								onClick={() => setSelectedChannelId(ch.id)}
								className={cn(
									"flex items-center justify-between rounded px-2 py-1.5 text-left text-xs hover:bg-accent",
									selectedChannelId === ch.id && "bg-accent"
								)}
							>
								<span className="flex-1 truncate">{ch.property}</span>
								<span className="text-muted-foreground text-[10px]">
									{ch.keyframes.length} kf
								</span>
							</button>
						))}
					</div>
					{showAddChannel ? (
						<div className="mt-2 space-y-2">
							<Input
								placeholder="Property name (e.g. opacity)"
								value={newProperty}
								onChange={(e) => setNewProperty(e.target.value)}
								className="h-7 text-xs"
							/>
							<Select value={newEasing} onValueChange={(v) => setNewEasing(v as EasingType)}>
								<SelectTrigger className="h-7 text-xs">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{EASING_OPTIONS.map((opt) => (
										<SelectItem key={opt.value} value={opt.value} className="text-xs">
											{opt.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<div className="flex gap-1">
								<Button size="sm" className="h-7 text-xs" onClick={handleAddChannel}>
									Add
								</Button>
								<Button
									size="sm"
									variant="ghost"
									className="h-7 text-xs"
									onClick={() => setShowAddChannel(false)}
								>
									Cancel
								</Button>
							</div>
						</div>
					) : (
						<Button
							size="sm"
							variant="ghost"
							className="mt-2 w-full gap-1.5 text-xs"
							onClick={() => setShowAddChannel(true)}
						>
							<HugeiconsIcon icon={Add01Icon} className="size-3.5" />
							Add Channel
						</Button>
					)}
				</div>

				{selectedChannel && (
					<div className="flex-1 overflow-y-auto p-3 space-y-4">
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<h4 className="text-sm font-medium">Keyframes</h4>
								<Button
									size="sm"
									variant="outline"
									className="h-6 text-xs"
									onClick={() => handleAddKeyframe(selectedChannel.id)}
								>
									<HugeiconsIcon icon={Add01Icon} className="size-3 mr-1" />
									Add
								</Button>
							</div>
							<div className="space-y-1">
								{selectedChannel.keyframes.map((kf) => (
									<KeyframeRow
										key={kf.id}
										keyframe={kf}
										channelId={selectedChannel.id}
										onUpdate={handleUpdateKeyframe}
										onDelete={handleDeleteKeyframe}
									/>
								))}
							</div>
						</div>

						<div className="space-y-2">
							<Label className="text-xs">Default Easing</Label>
							<Select
								value={selectedChannel.easing}
								onValueChange={(v) => {
									const ch = keyframeManager.getChannel(selectedChannel.id);
									if (ch) {
										ch.easing = v as EasingType;
										setChannels(keyframeManager.getAllChannels());
									}
								}}
							>
								<SelectTrigger className="h-7 text-xs">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{EASING_OPTIONS.map((opt) => (
										<SelectItem key={opt.value} value={opt.value} className="text-xs">
											{opt.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<EasingPreview easing={selectedChannel.easing} />
					</div>
				)}
			</div>
		</PanelView>
	);
}

function KeyframeRow({
	keyframe,
	channelId,
	onUpdate,
	onDelete,
}: {
	keyframe: Keyframe;
	channelId: string;
	onUpdate: (channelId: string, keyframeId: string, updates: Partial<Keyframe>) => void;
	onDelete: (channelId: string, keyframeId: string) => void;
}) {
	return (
		<div className="flex items-center gap-2 rounded border p-2">
			<div className="flex-1 space-y-1">
				<div className="flex gap-2">
					<div className="flex-1">
						<span className="text-muted-foreground text-[10px]">Time</span>
						<Input
							type="number"
							step={0.01}
							value={keyframe.time}
							onChange={(e) =>
								onUpdate(channelId, keyframe.id, { time: parseFloat(e.target.value) || 0 })
							}
							className="h-6 text-xs"
						/>
					</div>
					<div className="flex-1">
						<span className="text-muted-foreground text-[10px]">Value</span>
						<Input
							type="number"
							step={0.01}
							value={keyframe.value}
							onChange={(e) =>
								onUpdate(channelId, keyframe.id, { value: parseFloat(e.target.value) || 0 })
							}
							className="h-6 text-xs"
						/>
					</div>
				</div>
			</div>
			<button
				onClick={() => onDelete(channelId, keyframe.id)}
				className="text-muted-foreground hover:text-destructive"
			>
				<HugeiconsIcon icon={Delete01Icon} className="size-3.5" />
			</button>
		</div>
	);
}

function EasingPreview({ easing }: { easing: EasingType }) {
	const fn = EASING_FUNCTIONS[easing];
	const points: string[] = [];
	const steps = 50;

	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const v = fn(t);
		const x = (t * 100).toFixed(1);
		const y = ((1 - v) * 100).toFixed(1);
		points.push(`${x}% ${y}%`);
	}

	return (
		<div className="space-y-1">
			<Label className="text-xs">Curve Preview</Label>
			<div className="rounded border p-2">
				<svg viewBox="0 0 100 100" className="h-20 w-full">
					<polyline
						points={points.join(",")}
						fill="none"
						stroke="hsl(var(--primary))"
						strokeWidth="2"
					/>
				</svg>
			</div>
			<p className="text-muted-foreground text-xs capitalize">{easing}</p>
		</div>
	);
}
