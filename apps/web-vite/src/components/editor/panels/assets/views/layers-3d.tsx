"use client";

import { useState } from "react";
import { PanelView } from "@/components/editor/panels/assets/views/base-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { threeLayerManager, type Model3DAsset, type Layer3DConfig, type Transform3D, type Material3D, type Animation3D } from "@/3d/three-layer-manager";
import { Add01Icon, Upload01Icon, Delete01Icon, EyeIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/utils/ui";

interface Layer3DWithId {
	id: string;
	config: Layer3DConfig;
}

export function Layers3DView() {
	const [layers, setLayers] = useState<Layer3DWithId[]>([]);
	const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
	const [isImportOpen, setIsImportOpen] = useState(false);
	const [modelUrl, setModelUrl] = useState("");
	const [modelName, setModelName] = useState("");
	const [modelFormat, setModelFormat] = useState<"gltf" | "glb" | "obj" | "fbx" | "ply" | "splat">("glb");

	const selectedLayer = layers.find((l) => l.id === selectedLayerId);

	const handleImportModel = async () => {
		if (!modelUrl || !modelName) {
			toast.error("Model URL and name are required");
			return;
		}

		try {
			const asset: Model3DAsset = {
				id: crypto.randomUUID(),
				name: modelName,
				url: modelUrl,
				format: modelFormat,
				sizeBytes: 0,
			};

			const sceneId = "default-scene";
			await threeLayerManager.loadModel(sceneId, asset);

			const layerConfig: Layer3DConfig = {
				modelId: asset.id,
				transform: {
					position: { x: 0, y: 0, z: 0 },
					rotation: { x: 0, y: 0, z: 0 },
					scale: { x: 1, y: 1, z: 1 },
				},
				material: {
					color: "#ffffff",
					metalness: 0.5,
					roughness: 0.5,
					opacity: 1,
				},
				visible: true,
			};

			setLayers((prev) => [...prev, { id: crypto.randomUUID(), config: layerConfig }]);
			setIsImportOpen(false);
			setModelUrl("");
			setModelName("");
			toast.success(`Imported ${modelName}`);
		} catch (error) {
			toast.error(`Failed to import model: ${error instanceof Error ? error.message : "Unknown error"}`);
		}
	};

	const handleTransformChange = (axis: "position" | "rotation" | "scale", key: "x" | "y" | "z", value: number) => {
		if (!selectedLayer) return;

		const newTransform = {
			...selectedLayer.config.transform,
			[axis]: {
				...selectedLayer.config.transform[axis],
				[key]: value,
			},
		};

		const updatedLayers = layers.map((l) =>
			l.id === selectedLayerId
				? { ...l, config: { ...l.config, transform: newTransform } }
				: l
		);
		setLayers(updatedLayers);

		threeLayerManager.updateLayerTransform("default-scene", selectedLayer.config.modelId, newTransform);
	};

	const handleMaterialChange = (key: keyof Material3D, value: string | number) => {
		if (!selectedLayer) return;

		const newMaterial = {
			...selectedLayer.config.material,
			[key]: value,
		};

		setLayers((prev) =>
			prev.map((l) =>
				l.id === selectedLayerId
					? { ...l, config: { ...l.config, material: newMaterial } }
					: l
			)
		);
	};

	const handleAnimationChange = (anim: Animation3D | undefined) => {
		if (!selectedLayer) return;

		setLayers((prev) =>
			prev.map((l) =>
				l.id === selectedLayerId
					? { ...l, config: { ...l.config, animation: anim } }
					: l
			)
		);
	};

	const toggleVisibility = (layerId: string) => {
		setLayers((prev) =>
			prev.map((l) =>
				l.id === layerId
					? { ...l, config: { ...l.config, visible: !l.config.visible } }
					: l
			)
		);
	};

	const deleteLayer = (layerId: string) => {
		setLayers((prev) => prev.filter((l) => l.id !== layerId));
		if (selectedLayerId === layerId) setSelectedLayerId(null);
	};

	return (
		<PanelView
			title="3D Layers"
			actions={
				<Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
					<DialogTrigger asChild>
						<Button size="sm" variant="outline" className="gap-1.5">
							<HugeiconsIcon icon={Upload01Icon} className="size-4" />
							Import
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Import 3D Model</DialogTitle>
							<DialogDescription>
								Supports glTF, GLB, OBJ, FBX, PLY, and Splat formats.
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4">
							<div className="space-y-2">
								<Label>Name</Label>
								<Input
									value={modelName}
									onChange={(e) => setModelName(e.target.value)}
									placeholder="My Model"
								/>
							</div>
							<div className="space-y-2">
								<Label>URL</Label>
								<Input
									value={modelUrl}
									onChange={(e) => setModelUrl(e.target.value)}
									placeholder="https://example.com/model.glb"
								/>
							</div>
							<div className="space-y-2">
								<Label>Format</Label>
								<Select
									value={modelFormat}
									onValueChange={(v) =>
										setModelFormat(v as typeof modelFormat)
									}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="glb">GLB</SelectItem>
										<SelectItem value="gltf">glTF</SelectItem>
										<SelectItem value="obj">OBJ</SelectItem>
										<SelectItem value="fbx">FBX</SelectItem>
										<SelectItem value="ply">PLY</SelectItem>
										<SelectItem value="splat">Splat</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
						<DialogFooter>
							<Button onClick={handleImportModel}>Import Model</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			}
		>
			<div className="flex h-full flex-col">
				<div className="border-b p-2">
					<div className="flex flex-col gap-1">
						{layers.length === 0 && (
							<p className="text-muted-foreground text-xs p-2">
								No 3D layers. Import a model to get started.
							</p>
						)}
						{layers.map((layer) => (
							<button
								key={layer.id}
								onClick={() => setSelectedLayerId(layer.id)}
								className={cn(
									"flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent",
									selectedLayerId === layer.id && "bg-accent"
								)}
							>
								<button
									onClick={(e) => {
										e.stopPropagation();
										toggleVisibility(layer.id);
									}}
									className="text-muted-foreground hover:text-foreground"
								>
									<HugeiconsIcon
										icon={EyeIcon}
										className={cn("size-3.5", !layer.config.visible && "opacity-30")}
									/>
								</button>
								<span className="flex-1 truncate">{layer.config.modelId.slice(0, 8)}</span>
								<button
									onClick={(e) => {
										e.stopPropagation();
										deleteLayer(layer.id);
									}}
									className="text-muted-foreground hover:text-destructive"
								>
									<HugeiconsIcon icon={Delete01Icon} className="size-3.5" />
								</button>
							</button>
						))}
					</div>
				</div>

				{selectedLayer && (
					<div className="flex-1 overflow-y-auto p-3 space-y-4">
						<TransformSection
							transform={selectedLayer.config.transform}
							onChange={handleTransformChange}
						/>
						<MaterialSection
							material={selectedLayer.config.material}
							onChange={handleMaterialChange}
						/>
						<AnimationSection
							animation={selectedLayer.config.animation}
							onChange={handleAnimationChange}
						/>
					</div>
				)}
			</div>
		</PanelView>
	);
}

function TransformSection({
	transform,
	onChange,
}: {
	transform: Transform3D;
	onChange: (axis: "position" | "rotation" | "scale", key: "x" | "y" | "z", value: number) => void;
}) {
	return (
		<div className="space-y-3">
			<h4 className="text-sm font-medium">Transform</h4>
			{(["position", "rotation", "scale"] as const).map((axis) => (
				<div key={axis} className="space-y-1.5">
					<span className="text-muted-foreground text-xs capitalize">{axis}</span>
					<div className="grid grid-cols-3 gap-2">
						{(["x", "y", "z"] as const).map((key) => (
							<div key={key} className="space-y-1">
								<span className="text-muted-foreground text-[10px] uppercase">{key}</span>
								<Input
									type="number"
									step={axis === "scale" ? 0.1 : 1}
									value={transform[axis][key]}
									onChange={(e) =>
										onChange(axis, key, parseFloat(e.target.value) || 0)
									}
									className="h-7 text-xs"
								/>
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	);
}

function MaterialSection({
	material,
	onChange,
}: {
	material: Material3D;
	onChange: (key: keyof Material3D, value: string | number) => void;
}) {
	return (
		<div className="space-y-3">
			<h4 className="text-sm font-medium">Material</h4>
			<div className="space-y-2">
				<Label className="text-xs">Color</Label>
				<div className="flex gap-2">
					<Input
						type="color"
						value={material.color}
						onChange={(e) => onChange("color", e.target.value)}
						className="h-8 w-12 p-1"
					/>
					<Input
						value={material.color}
						onChange={(e) => onChange("color", e.target.value)}
						className="h-8 text-xs"
					/>
				</div>
			</div>
			<div className="space-y-2">
				<div className="flex justify-between">
					<Label className="text-xs">Metalness</Label>
					<span className="text-muted-foreground text-xs">{material.metalness.toFixed(2)}</span>
				</div>
				<Slider
					value={[material.metalness]}
					onValueChange={([v]) => onChange("metalness", v)}
					min={0}
					max={1}
					step={0.01}
				/>
			</div>
			<div className="space-y-2">
				<div className="flex justify-between">
					<Label className="text-xs">Roughness</Label>
					<span className="text-muted-foreground text-xs">{material.roughness.toFixed(2)}</span>
				</div>
				<Slider
					value={[material.roughness]}
					onValueChange={([v]) => onChange("roughness", v)}
					min={0}
					max={1}
					step={0.01}
				/>
			</div>
			<div className="space-y-2">
				<div className="flex justify-between">
					<Label className="text-xs">Opacity</Label>
					<span className="text-muted-foreground text-xs">{material.opacity.toFixed(2)}</span>
				</div>
				<Slider
					value={[material.opacity]}
					onValueChange={([v]) => onChange("opacity", v)}
					min={0}
					max={1}
					step={0.01}
				/>
			</div>
		</div>
	);
}

function AnimationSection({
	animation,
	onChange,
}: {
	animation: Animation3D | undefined;
	onChange: (anim: Animation3D | undefined) => void;
}) {
	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<h4 className="text-sm font-medium">Animation</h4>
				<Button
					size="sm"
					variant="ghost"
					className="h-6 text-xs"
					onClick={() =>
						onChange(
							animation
								? undefined
								: { type: "rotate", speed: 1, axis: "y", loop: true }
						)
					}
				>
					{animation ? "Remove" : "Add"}
				</Button>
			</div>
			{animation && (
				<div className="space-y-2">
					<div className="space-y-2">
						<Label className="text-xs">Type</Label>
						<Select
							value={animation.type}
							onValueChange={(v) =>
								onChange({
									...animation,
									type: v as Animation3D["type"],
								})
							}
						>
							<SelectTrigger className="h-7 text-xs">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="rotate">Rotate</SelectItem>
								<SelectItem value="spin">Spin</SelectItem>
								<SelectItem value="bounce">Bounce</SelectItem>
								<SelectItem value="float">Float</SelectItem>
								<SelectItem value="pulse">Pulse</SelectItem>
								<SelectItem value="orbit">Orbit</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<div className="flex justify-between">
							<Label className="text-xs">Speed</Label>
							<span className="text-muted-foreground text-xs">{animation.speed.toFixed(1)}x</span>
						</div>
						<Slider
							value={[animation.speed]}
							onValueChange={([v]) => onChange({ ...animation, speed: v })}
							min={0.1}
							max={5}
							step={0.1}
						/>
					</div>
					<div className="space-y-2">
						<Label className="text-xs">Axis</Label>
						<Select
							value={animation.axis}
							onValueChange={(v) =>
								onChange({
									...animation,
									axis: v as Animation3D["axis"],
								})
							}
						>
							<SelectTrigger className="h-7 text-xs">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="x">X</SelectItem>
								<SelectItem value="y">Y</SelectItem>
								<SelectItem value="z">Z</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="flex items-center gap-2">
						<input
							type="checkbox"
							id="loop-anim"
							checked={animation.loop}
							onChange={(e) => onChange({ ...animation, loop: e.target.checked })}
							className="size-3.5"
						/>
						<Label htmlFor="loop-anim" className="text-xs">Loop</Label>
					</div>
				</div>
			)}
		</div>
	);
}
