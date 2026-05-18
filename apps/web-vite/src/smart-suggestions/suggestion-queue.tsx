import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/ui";

export type SuggestionSeverity = "warning" | "improvement" | "info";

export interface Suggestion {
	id: string;
	title: string;
	description: string;
	severity: SuggestionSeverity;
	action?: () => void;
	actionLabel?: string;
}

class SuggestionQueue {
	private suggestions: Suggestion[] = [];

	add(suggestion: Suggestion): void {
		this.suggestions.push(suggestion);
	}

	remove(id: string): void {
		this.suggestions = this.suggestions.filter((s) => s.id !== id);
	}

	getAll(): Suggestion[] {
		return [...this.suggestions].sort((a, b) => {
			const severityOrder = { warning: 0, improvement: 1, info: 2 };
			return severityOrder[a.severity] - severityOrder[b.severity];
		});
	}

	clear(): void {
		this.suggestions = [];
	}
}

export const suggestionQueue = new SuggestionQueue();

export function SuggestionCard({
	suggestion,
	onDismiss,
}: {
	suggestion: Suggestion;
	onDismiss: () => void;
}) {
	const [isHovered, setIsHovered] = useState(false);
	const [dismissTimer, setDismissTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

	const handleMouseEnter = useCallback(() => {
		setIsHovered(true);
		if (dismissTimer) {
			clearTimeout(dismissTimer);
			setDismissTimer(null);
		}
	}, [dismissTimer]);

	const handleMouseLeave = useCallback(() => {
		setIsHovered(false);
		const timer = setTimeout(() => onDismiss(), 30000);
		setDismissTimer(timer);
	}, [onDismiss]);

	const severityColors = {
		warning: "border-amber-500/50 bg-amber-500/10",
		improvement: "border-blue-500/50 bg-blue-500/10",
		info: "border-muted bg-muted/30",
	};

	return (
		<div
			className={cn("p-3 border rounded space-y-2", severityColors[suggestion.severity])}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
		>
			<div className="flex items-start justify-between">
				<div>
					<h4 className="text-xs font-medium">{suggestion.title}</h4>
					<p className="text-[10px] text-muted-foreground mt-0.5">{suggestion.description}</p>
				</div>
				<button
					type="button"
					className="text-muted-foreground hover:text-foreground"
					onClick={onDismiss}
				>
					×
				</button>
			</div>
			{suggestion.action && suggestion.actionLabel && (
				<Button size="sm" variant="outline" className="text-xs" onClick={suggestion.action}>
					{suggestion.actionLabel}
				</Button>
			)}
		</div>
	);
}
