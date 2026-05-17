import { cn } from "@/utils/ui";
import type { Transition, TransitionType } from "@/timeline";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";

const TRANSITION_TYPES: { type: TransitionType; label: string }[] = [
	{ type: "crossfade", label: "Crossfade" },
	{ type: "slide-left", label: "Slide Left" },
	{ type: "slide-right", label: "Slide Right" },
	{ type: "slide-up", label: "Slide Up" },
	{ type: "slide-down", label: "Slide Down" },
	{ type: "wipe-left", label: "Wipe Left" },
	{ type: "wipe-right", label: "Wipe Right" },
	{ type: "zoom-in", label: "Zoom In" },
	{ type: "zoom-out", label: "Zoom Out" },
];

const TRANSITION_DURATIONS = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0];

interface TransitionIndicatorProps {
	transition: Transition | undefined;
	onTransitionChange: (transition: Transition | undefined) => void;
	elementWidth: number;
}

export function TransitionIndicator({
	transition,
	onTransitionChange,
	elementWidth,
}: TransitionIndicatorProps) {
	const indicatorWidth = Math.min(24, elementWidth / 3);

	if (!transition) {
		return (
			<ContextMenu>
				<ContextMenuTrigger asChild>
					<button
						type="button"
						className="absolute right-0 top-0 bottom-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
						style={{ width: `${indicatorWidth}px` }}
						onClick={(e) => e.stopPropagation()}
						onMouseDown={(e) => e.stopPropagation()}
					>
						<div className="w-1.5 h-1.5 rounded-full border border-white/50" />
					</button>
				</ContextMenuTrigger>
				<ContextMenuContent className="w-48">
					<div className="px-2 py-1.5 text-xs text-muted-foreground">
						Add Transition
					</div>
					<ContextMenuSeparator />
					{TRANSITION_TYPES.map(({ type, label }) => (
						<ContextMenuItem
							key={type}
							onClick={() =>
								onTransitionChange({ type, duration: 0.5 })
							}
						>
							{label}
						</ContextMenuItem>
					))}
				</ContextMenuContent>
			</ContextMenu>
		);
	}

	const transitionType = TRANSITION_TYPES.find(
		(t) => t.type === transition.type,
	);

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<button
					type="button"
					className={cn(
						"absolute right-0 top-0 bottom-0 flex items-center justify-center",
						"bg-gradient-to-l from-primary/40 to-transparent",
					)}
					style={{ width: `${indicatorWidth}px` }}
					onClick={(e) => e.stopPropagation()}
					onMouseDown={(e) => e.stopPropagation()}
				>
					<div className="w-1 h-4 rounded-full bg-primary/60" />
				</button>
			</ContextMenuTrigger>
			<ContextMenuContent className="w-48">
				<div className="px-2 py-1.5 text-xs text-muted-foreground">
					{transitionType?.label ?? transition.type} ({transition.duration}s)
				</div>
				<ContextMenuSeparator />
				<div className="px-2 py-1 text-xs text-muted-foreground">Change Type</div>
				{TRANSITION_TYPES.map(({ type, label }) => (
					<ContextMenuItem
						key={type}
						onClick={() =>
							onTransitionChange({ type, duration: transition.duration })
						}
					>
						{type === transition.type && (
							<span className="mr-1">✓</span>
						)}
						{label}
					</ContextMenuItem>
				))}
				<ContextMenuSeparator />
				<div className="px-2 py-1 text-xs text-muted-foreground">Duration</div>
				{TRANSITION_DURATIONS.map((dur) => (
					<ContextMenuItem
						key={dur}
						onClick={() =>
							onTransitionChange({ type: transition.type, duration: dur })
						}
					>
						{Math.abs(transition.duration - dur) < 0.01 && (
							<span className="mr-1">✓</span>
						)}
						{dur}s
					</ContextMenuItem>
				))}
				<ContextMenuSeparator />
				<ContextMenuItem
					className="text-destructive focus:text-destructive"
					onClick={() => onTransitionChange(undefined)}
				>
					Remove Transition
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}
