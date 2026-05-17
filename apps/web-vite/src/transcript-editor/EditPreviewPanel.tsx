import React from "react";
import type { EditOperation } from "@/text-edit-engine/types";
import { cn } from "@/utils/ui";

interface EditPreviewPanelProps {
	editOperations: EditOperation[];
	onConfirm: () => void;
	onCancel: () => void;
}

export const EditPreviewPanel: React.FC<EditPreviewPanelProps> = ({
	editOperations,
	onConfirm,
	onCancel,
}) => {
	const totalDurationRemoved = editOperations.reduce(
		(sum, op) => sum + op.preview.durationRemoved,
		0,
	);

	return (
		<div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div className="p-4">
				<div className="flex items-center justify-between mb-3">
					<h3 className="text-sm font-semibold">Edit Preview</h3>
					<span className="text-xs text-muted-foreground">
						{editOperations.length} cut{editOperations.length !== 1 ? "s" : ""} •{" "}
						{totalDurationRemoved.toFixed(1)}s removed
					</span>
				</div>

				<div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
					{editOperations.map((op) => (
						<div
							key={op.id}
							className="p-3 rounded-md border border-destructive/20 bg-destructive/5"
						>
							<div className="flex items-start justify-between">
								<div className="flex-1 min-w-0">
									<p className="text-sm font-medium text-destructive">
										Delete: {op.timeRange.start.toFixed(1)}s →{" "}
										{op.timeRange.end.toFixed(1)}s
									</p>
									<p className="text-xs text-muted-foreground mt-1 truncate">
										"{op.deletedText}"
									</p>
								</div>
								<div className="text-xs text-muted-foreground ml-3 whitespace-nowrap">
									{op.preview.durationRemoved.toFixed(1)}s
								</div>
							</div>

							{op.preview.affectedClips.length > 0 && (
								<div className="mt-2 pt-2 border-t border-destructive/10">
									<p className="text-xs text-muted-foreground mb-1">
										Affected clips:
									</p>
									<div className="flex flex-wrap gap-1">
										{op.preview.affectedClips.map((clip) => (
											<span
												key={clip.clipId}
												className="px-2 py-0.5 text-xs rounded-full bg-accent"
											>
												{clip.clipName} ({clip.action})
											</span>
										))}
									</div>
								</div>
							)}
						</div>
					))}
				</div>

				<div className="flex items-center justify-end gap-2">
					<button
						onClick={onCancel}
						className="px-4 py-2 text-sm border border-input rounded-md hover:bg-accent"
					>
						Cancel
					</button>
					<button
						onClick={onConfirm}
						className="px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90"
					>
						Apply {editOperations.length} Cut{editOperations.length !== 1 ? "s" : ""}
					</button>
				</div>
			</div>
		</div>
	);
};
