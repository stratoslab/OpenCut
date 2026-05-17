import { useState } from "react";
import { useEditor } from "@/editor/use-editor";
import { UpdateElementsCommand } from "@/commands/timeline/element/update-elements";
import type { TransitionType, VideoElement, ImageElement } from "@/timeline";
import { cn } from "@/utils/ui";

const TRANSITIONS: { type: TransitionType; label: string; description: string }[] = [
	{ type: "crossfade", label: "Crossfade", description: "Smooth opacity blend" },
	{ type: "slide-left", label: "Slide Left", description: "Incoming clips slides from left" },
	{ type: "slide-right", label: "Slide Right", description: "Incoming clips slides from right" },
	{ type: "slide-up", label: "Slide Up", description: "Incoming clips slides from top" },
	{ type: "slide-down", label: "Slide Down", description: "Incoming clips slides from bottom" },
	{ type: "wipe-left", label: "Wipe Left", description: "Hard wipe reveal from left" },
	{ type: "wipe-right", label: "Wipe Right", description: "Hard wipe reveal from right" },
	{ type: "zoom-in", label: "Zoom In", description: "Outgoing zooms in, incoming fades" },
	{ type: "zoom-out", label: "Zoom Out", description: "Outgoing fades, incoming zooms" },
];

const DURATIONS = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0];

export function TransitionsView() {
	const editor = useEditor();
	const [selectedDuration, setSelectedDuration] = useState(0.5);
	const [hoveredType, setHoveredType] = useState<TransitionType | null>(null);

	const selectedElements = editor.selection.getSelectedElements();
	const hasSelection = selectedElements.length === 1;
	const selectedElement = hasSelection ? selectedElements[0] : null;

	const scene = editor.scenes.getActiveScene();
	const track = selectedElement
		? scene.tracks.overlay.find((t) => t.id === selectedElement.trackId) ??
		  (scene.tracks.main.id === selectedElement.trackId ? scene.tracks.main : null)
		: null;
	const element = track?.elements.find((e) => e.id === selectedElement?.elementId) as
		| VideoElement
		| ImageElement
		| undefined;

	const isVideoOrImage =
		element?.type === "video" || element?.type === "image";
	const currentTransition = isVideoOrImage ? element.exitTransition : undefined;

	const handleTransitionClick = (type: TransitionType) => {
		if (!selectedElement || !isVideoOrImage) return;
		editor.command.execute({
			command: new UpdateElementsCommand({
				updates: [
					{
						trackId: selectedElement.trackId,
						elementId: selectedElement.elementId,
						patch: { exitTransition: { type, duration: selectedDuration } },
					},
				],
			}),
		});
	};

	const handleDurationChange = (duration: number) => {
		setSelectedDuration(duration);
		if (!selectedElement || !isVideoOrImage || !currentTransition) return;
		editor.command.execute({
			command: new UpdateElementsCommand({
				updates: [
					{
						trackId: selectedElement.trackId,
						elementId: selectedElement.elementId,
						patch: {
							exitTransition: {
								...currentTransition,
								duration,
							},
						},
					},
				],
			}),
		});
	};

	const handleRemoveTransition = () => {
		if (!selectedElement || !isVideoOrImage) return;
		editor.command.execute({
			command: new UpdateElementsCommand({
				updates: [
					{
						trackId: selectedElement.trackId,
						elementId: selectedElement.elementId,
						patch: { exitTransition: undefined },
					},
				],
			}),
		});
	};

	return (
		<div className="flex flex-col h-full">
			<div className="p-3 border-b">
				<h3 className="text-sm font-medium">Transitions</h3>
				<p className="text-xs text-muted-foreground mt-0.5">
					{hasSelection && isVideoOrImage
						? "Select a transition to apply to the selected clip"
						: "Select a video or image clip to add transitions"}
				</p>
			</div>

			<div className="flex-1 overflow-y-auto p-3">
				<div className="grid grid-cols-2 gap-2">
					{TRANSITIONS.map(({ type, label, description }) => {
						const isActive = currentTransition?.type === type;
						const isHovered = hoveredType === type;
						return (
							<button
								key={type}
								type="button"
								disabled={!hasSelection || !isVideoOrImage}
								className={cn(
									"flex flex-col items-center justify-center p-3 rounded-lg border transition-all",
									isActive
										? "border-primary bg-primary/10"
										: "border-border hover:border-primary/50",
									(!hasSelection || !isVideoOrImage) && "opacity-40 cursor-not-allowed",
								)}
								onMouseEnter={() => setHoveredType(type)}
								onMouseLeave={() => setHoveredType(null)}
								onClick={() => handleTransitionClick(type)}
							>
								<TransitionPreview
									type={type}
									isActive={isActive}
									isHovered={isHovered}
								/>
								<span className="text-xs font-medium mt-2">{label}</span>
								<span className="text-[10px] text-muted-foreground text-center">
									{description}
								</span>
							</button>
						);
					})}
				</div>
			</div>

			{currentTransition && (
				<div className="p-3 border-t space-y-2">
					<div className="flex items-center justify-between">
						<span className="text-xs font-medium">Duration</span>
						<button
							type="button"
							className="text-xs text-destructive hover:underline"
							onClick={handleRemoveTransition}
						>
							Remove
						</button>
					</div>
					<div className="flex gap-1">
						{DURATIONS.map((dur) => (
							<button
								key={dur}
								type="button"
								className={cn(
									"flex-1 py-1 px-2 text-xs rounded border transition-all",
									Math.abs(currentTransition.duration - dur) < 0.01
										? "border-primary bg-primary/10 text-primary"
										: "border-border hover:border-primary/50",
								)}
								onClick={() => handleDurationChange(dur)}
							>
								{dur}s
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

function TransitionPreview({
	type,
	isActive,
	isHovered,
}: {
	type: TransitionType;
	isActive: boolean;
	isHovered: boolean;
}) {
	const color = isActive ? "bg-primary" : isHovered ? "bg-primary/50" : "bg-muted-foreground/30";

	switch (type) {
		case "crossfade":
			return (
				<div className="relative w-10 h-10">
					<div className={cn("absolute inset-0 rounded", color, "opacity-70")} />
					<div className={cn("absolute inset-1 rounded", color, "opacity-40")} />
				</div>
			);
		case "slide-left":
		case "slide-right":
		case "slide-up":
		case "slide-down":
			const dir = type.replace("slide-", "");
			return (
				<div className="relative w-10 h-10 overflow-hidden rounded">
					<div className={cn("absolute inset-0", "bg-muted-foreground/20")} />
					<div
						className={cn(
							"absolute inset-y-0 w-1/2 rounded",
							color,
							dir === "left" && "right-0",
							dir === "right" && "left-0",
							dir === "up" && "bottom-0 w-full h-1/2",
							dir === "down" && "top-0 w-full h-1/2",
						)}
					/>
				</div>
			);
		case "wipe-left":
		case "wipe-right":
			const wipeDir = type.replace("wipe-", "");
			return (
				<div className="relative w-10 h-10 overflow-hidden rounded">
					<div className={cn("absolute inset-0", "bg-muted-foreground/20")} />
					<div
						className={cn(
							"absolute inset-y-0 w-1/2 rounded",
							color,
							wipeDir === "left" && "right-0",
							wipeDir === "right" && "left-0",
						)}
					/>
				</div>
			);
		case "zoom-in":
			return (
				<div className="relative w-10 h-10 flex items-center justify-center">
					<div className={cn("w-8 h-8 rounded-full", color, "opacity-40")} />
					<div className={cn("absolute w-5 h-5 rounded-full", color)} />
				</div>
			);
		case "zoom-out":
			return (
				<div className="relative w-10 h-10 flex items-center justify-center">
					<div className={cn("w-5 h-5 rounded-full", color, "opacity-40")} />
					<div className={cn("absolute w-8 h-8 rounded-full border-2", color.replace("bg-", "border-"), "bg-transparent")} />
				</div>
			);
	}
}
