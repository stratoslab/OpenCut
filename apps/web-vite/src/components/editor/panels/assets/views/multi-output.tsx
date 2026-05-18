"use client";

import { useState } from "react";
import { PanelView } from "@/components/editor/panels/assets/views/base-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { multiOutputRouter, type OutputTarget } from "@/rendering/multi-output";
import { Add01Icon, Delete01Icon, Tv01Icon, Video01Icon, Radio01Icon, RecordIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/utils/ui";
import { toast } from "sonner";

const OUTPUT_TYPE_ICONS = {
	preview: Tv01Icon,
	"external-monitor": Tv01Icon,
	streaming: Radio01Icon,
	recording: RecordIcon,
};

const OUTPUT_TYPE_LABELS = {
	preview: "Preview",
	"external-monitor": "External Monitor",
	streaming: "Streaming",
	recording: "Recording",
};

export function MultiOutputView() {
	const [outputs, setOutputs] = useState<OutputTarget[]>(multiOutputRouter.getAllOutputs());
	const [activeOutputId, setActiveOutputId] = useState<string | null>(multiOutputRouter.getActiveOutput()?.id ?? null);
	const [showAdd, setShowAdd] = useState(false);
	const [newName, setNewName] = useState("");
	const [newType, setNewType] = useState<OutputTarget["type"]>("preview");
	const [newWidth, setNewWidth] = useState(1920);
	const [newHeight, setNewHeight] = useState(1080);

	const handleAddOutput = () => {
		if (!newName) {
			toast.error("Output name is required");
			return;
		}

		const canvas = document.createElement("canvas");
		canvas.width = newWidth;
		canvas.height = newHeight;

		const target: OutputTarget = {
			id: `output-${crypto.randomUUID()}`,
			name: newName,
			type: newType,
			canvas,
			resolution: { width: newWidth, height: newHeight },
			enabled: true,
		};

		multiOutputRouter.addOutput(target);
		setOutputs(multiOutputRouter.getAllOutputs());
		setNewName("");
		setShowAdd(false);
		toast.success(`Added ${newName}`);
	};

	const handleRemoveOutput = (id: string) => {
		multiOutputRouter.removeOutput(id);
		setOutputs(multiOutputRouter.getAllOutputs());
		if (activeOutputId === id) {
			const active = multiOutputRouter.getActiveOutput();
			setActiveOutputId(active?.id ?? null);
		}
	};

	const handleSetActive = (id: string) => {
		multiOutputRouter.setActiveOutput(id);
		setActiveOutputId(id);
	};

	const handleToggle = (id: string) => {
		multiOutputRouter.toggleOutput(id);
		setOutputs(multiOutputRouter.getAllOutputs());
	};

	return (
		<PanelView
			title="Multi-Output"
			actions={
				<Button
					size="sm"
					variant="outline"
					className="gap-1.5"
					onClick={() => setShowAdd(!showAdd)}
				>
					<HugeiconsIcon icon={Add01Icon} className="size-3.5" />
					Add
				</Button>
			}
		>
			<div className="flex h-full flex-col">
				{showAdd && (
					<div className="border-b p-3 space-y-3">
						<div className="space-y-2">
							<Label className="text-xs">Name</Label>
							<Input
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								placeholder="Output name"
								className="h-7 text-xs"
							/>
						</div>
						<div className="space-y-2">
							<Label className="text-xs">Type</Label>
							<Select
								value={newType}
								onValueChange={(v) => setNewType(v as OutputTarget["type"])}
							>
								<SelectTrigger className="h-7 text-xs">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{Object.entries(OUTPUT_TYPE_LABELS).map(([key, label]) => (
										<SelectItem key={key} value={key} className="text-xs">
											{label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid grid-cols-2 gap-2">
							<div className="space-y-2">
								<Label className="text-xs">Width</Label>
								<Input
									type="number"
									value={newWidth}
									onChange={(e) => setNewWidth(parseInt(e.target.value) || 1920)}
									className="h-7 text-xs"
								/>
							</div>
							<div className="space-y-2">
								<Label className="text-xs">Height</Label>
								<Input
									type="number"
									value={newHeight}
									onChange={(e) => setNewHeight(parseInt(e.target.value) || 1080)}
									className="h-7 text-xs"
								/>
							</div>
						</div>
						<div className="flex gap-1">
							<Button size="sm" className="h-7 text-xs" onClick={handleAddOutput}>
								Add Output
							</Button>
							<Button
								size="sm"
								variant="ghost"
								className="h-7 text-xs"
								onClick={() => setShowAdd(false)}
							>
								Cancel
							</Button>
						</div>
					</div>
				)}

				<div className="flex-1 overflow-y-auto p-3 space-y-2">
					{outputs.length === 0 && (
						<p className="text-muted-foreground text-center text-xs py-8">
							No outputs configured. Add one to route frames.
						</p>
					)}
					{outputs.map((output) => {
						const Icon = OUTPUT_TYPE_ICONS[output.type];
						const isActive = output.id === activeOutputId;

						return (
							<div
								key={output.id}
								className={cn(
									"rounded border p-3 space-y-2",
									isActive && "border-primary"
								)}
							>
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<HugeiconsIcon icon={Icon} className="size-4 text-muted-foreground" />
										<div>
											<p className="text-sm font-medium">{output.name}</p>
											<p className="text-muted-foreground text-xs">
												{OUTPUT_TYPE_LABELS[output.type]} · {output.resolution.width}×{output.resolution.height}
											</p>
										</div>
									</div>
									<div className="flex items-center gap-1">
										<Switch
											checked={output.enabled}
											onCheckedChange={() => handleToggle(output.id)}
										/>
										<button
											onClick={() => handleRemoveOutput(output.id)}
											className="text-muted-foreground hover:text-destructive"
										>
											<HugeiconsIcon icon={Delete01Icon} className="size-3.5" />
										</button>
									</div>
								</div>
								{!isActive && (
									<Button
										size="sm"
										variant="outline"
										className="w-full text-xs"
										onClick={() => handleSetActive(output.id)}
									>
										Set Active
									</Button>
								)}
								{isActive && (
									<p className="text-primary text-center text-xs font-medium">
										Active Output
									</p>
								)}
							</div>
						);
					})}
				</div>
			</div>
		</PanelView>
	);
}
