"use client";

import { useState } from "react";
import { PanelView } from "@/components/editor/panels/assets/views/base-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
	textAnimationManager,
	type TextAnimationPreset,
	type TextAnimation,
} from "@/text/text-animations";
import { cn } from "@/utils/ui";

type CategoryFilter = "all" | "entrance" | "exit" | "emphasis" | "special";

export function TextAnimationsView() {
	const [selectedPreset, setSelectedPreset] = useState<TextAnimationPreset | null>(null);
	const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
	const [customDuration, setCustomDuration] = useState(0.5);
	const [customDelay, setCustomDelay] = useState(0);

	const presets = categoryFilter === "all"
		? textAnimationManager.getAllPresets()
		: textAnimationManager.getPresetsByCategory(categoryFilter);

	const categories: { id: CategoryFilter; label: string }[] = [
		{ id: "all", label: "All" },
		{ id: "entrance", label: "Entrance" },
		{ id: "exit", label: "Exit" },
		{ id: "emphasis", label: "Emphasis" },
		{ id: "special", label: "Special" },
	];

	const handleApplyAnimation = () => {
		if (!selectedPreset) return;

		const animation: TextAnimation = {
			...selectedPreset.animation,
			duration: customDuration,
			delay: customDelay,
		};

		// TODO: Wire to editor text element system
		// This requires integration with the timeline and text element rendering pipeline
		console.log("Text animation apply (not yet integrated):", animation);
	};

	return (
		<PanelView title="Text Animations">
			<div className="flex h-full flex-col">
				<div className="flex gap-1 border-b p-2 overflow-x-auto">
					{categories.map((cat) => (
						<button
							key={cat.id}
							onClick={() => setCategoryFilter(cat.id)}
							className={cn(
								"whitespace-nowrap rounded px-2 py-1 text-xs font-medium hover:bg-accent",
								categoryFilter === cat.id
									? "bg-accent text-foreground"
									: "text-muted-foreground"
							)}
						>
							{cat.label}
						</button>
					))}
				</div>

				<div className="flex-1 overflow-y-auto p-3">
					<div className="grid grid-cols-2 gap-2">
						{presets.map((preset) => (
							<button
								key={preset.id}
								onClick={() => setSelectedPreset(preset)}
								className={cn(
									"rounded border p-3 text-left transition-colors hover:bg-accent",
									selectedPreset?.id === preset.id && "border-primary bg-accent"
								)}
							>
								<p className="text-sm font-medium">{preset.name}</p>
								<span
									className={cn(
										"text-[10px] capitalize",
										preset.category === "entrance" && "text-green-500",
										preset.category === "exit" && "text-red-500",
										preset.category === "emphasis" && "text-yellow-500",
										preset.category === "special" && "text-purple-500"
									)}
								>
									{preset.category}
								</span>
							</button>
						))}
					</div>

					{selectedPreset && (
						<div className="mt-4 space-y-3 rounded border p-3">
							<h4 className="text-sm font-medium">{selectedPreset.name}</h4>

							<div className="space-y-2">
								<div className="flex justify-between">
									<Label className="text-xs">Duration</Label>
									<span className="text-muted-foreground text-xs">
										{customDuration.toFixed(2)}s
									</span>
								</div>
								<Slider
									value={[customDuration]}
									onValueChange={([v]) => setCustomDuration(v)}
									min={0.1}
									max={3}
									step={0.05}
								/>
							</div>

							<div className="space-y-2">
								<div className="flex justify-between">
									<Label className="text-xs">Delay</Label>
									<span className="text-muted-foreground text-xs">
										{customDelay.toFixed(2)}s
									</span>
								</div>
								<Slider
									value={[customDelay]}
									onValueChange={([v]) => setCustomDelay(v)}
									min={0}
									max={2}
									step={0.05}
								/>
							</div>

							<div className="space-y-1">
								<Label className="text-xs">Easing</Label>
								<p className="text-muted-foreground text-xs capitalize">
									{selectedPreset.animation.easing}
								</p>
							</div>

							<Button
								size="sm"
								className="w-full text-xs"
								onClick={handleApplyAnimation}
							>
								Apply Animation
							</Button>
						</div>
					)}
				</div>
			</div>
		</PanelView>
	);
}
