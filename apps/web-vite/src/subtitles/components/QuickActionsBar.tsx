import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/ui";

interface QuickActionsBarProps {
	onSmartCut?: () => void;
	onRemoveFillers?: () => void;
	onRemoveSilence?: () => void;
	onAddSubtitles?: () => void;
	onHormoziStyle?: () => void;
	className?: string;
}

export function QuickActionsBar({
	onSmartCut,
	onRemoveFillers,
	onRemoveSilence,
	onAddSubtitles,
	onHormoziStyle,
	className,
}: QuickActionsBarProps) {
	const actions = [
		{ label: "Smart Cut", icon: "✂️", handler: onSmartCut },
		{ label: "Remove Fillers", icon: "🗑️", handler: onRemoveFillers },
		{ label: "Remove Silence", icon: "🔇", handler: onRemoveSilence },
		{ label: "Add Subtitles", icon: "💬", handler: onAddSubtitles },
		{ label: "Hormozi Style", icon: "🎨", handler: onHormoziStyle },
	].filter((a) => a.handler);

	if (actions.length === 0) return null;

	return (
		<div className={cn("flex items-center gap-2 p-2 bg-popover border rounded shadow-sm", className)}>
			<span className="text-[10px] text-muted-foreground font-medium mr-1">Quick Actions:</span>
			{actions.map((action) => (
				<Button
					key={action.label}
					variant="outline"
					size="sm"
					className="text-xs gap-1"
					onClick={action.handler}
				>
					<span>{action.icon}</span>
					{action.label}
				</Button>
			))}
		</div>
	);
}
